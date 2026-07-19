import * as usbModule from "usb";

const usbObj = ((usbModule as any).findByIds ? usbModule : (usbModule as any).default || usbModule) as any;

export class uDMXTransmitter {
  private device: any = null;
  private isConnected = false;
  private vid = 0x16c0; // Anyma uDMX Vendor ID
  private pid = 0x05dc; // Anyma uDMX Product ID
  private verbose = false;

  constructor(options?: { verbose?: boolean; vid?: number; pid?: number }) {
    if (options?.verbose) this.verbose = options.verbose;
    if (options?.vid) this.vid = options.vid;
    if (options?.pid) this.pid = options.pid;
  }

  /**
   * Attempt to find and connect to the physical uDMX device.
   * Returns true if successful, false if it defaults to Virtual/Mock mode.
   */
  public connect(): boolean {
    try {
      if (this.verbose) {
        console.log(`[uDMX] Buscando dispositivo USB (VID: 0x${this.vid.toString(16)}, PID: 0x${this.pid.toString(16)})...`);
      }

      // Find device
      this.device = usbObj.findByIds(this.vid, this.pid);

      if (!this.device) {
        console.warn("[uDMX] Dispositivo físico no encontrado. Iniciando en MODO VIRTUAL (Simulador).");
        this.isConnected = false;
        return false;
      }

      // Open device
      this.device.open();
      
      // On some platforms/OS, we might need to detach kernel driver.
      // We wrap it in a try-catch since it's only needed on some configurations.
      try {
        if (this.device.interfaces && this.device.interfaces[0]) {
          const iface = this.device.interfaces[0];
          if (iface.isKernelDriverActive()) {
            iface.detachKernelDriver();
            if (this.verbose) console.log("[uDMX] Driver del kernel desactivado.");
          }
          iface.claim();
        }
      } catch (err) {
        if (this.verbose) {
          console.warn("[uDMX] Advertencia al reclamar interfaz USB (a veces macOS no lo requiere):", err);
        }
      }

      this.isConnected = true;
      console.log("[uDMX] ¡Conectado con éxito al dispositivo físico DMX!");
      return true;
    } catch (error) {
      console.error("[uDMX] Error al conectar con el dispositivo USB. Iniciando en MODO VIRTUAL:", error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Close the USB device connection.
   */
  public disconnect(): void {
    if (!this.isConnected || !this.device) return;

    try {
      // Release interface if claimed
      try {
        if (this.device.interfaces && this.device.interfaces[0]) {
          this.device.interfaces[0].release(true, (err: any) => {
            if (err && this.verbose) console.warn("[uDMX] Error al liberar interfaz USB:", err);
          });
        }
      } catch (e) {}

      this.device.close();
      this.isConnected = false;
      console.log("[uDMX] Dispositivo desconectado.");
    } catch (error) {
      console.error("[uDMX] Error al cerrar conexión USB:", error);
    }
  }

  /**
   * Returns whether the physical USB device is connected.
   */
  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Transmit the modified DMX channels over USB.
   * Uses optimization: if a few channels changed, sends single channel transfers.
   * If many channels changed, sends a single multi-channel range transfer.
   */
  public transmitChanges(changes: Map<number, number>, fullBuffer: Uint8Array): void {
    if (changes.size === 0) return;

    if (!this.isConnected || !this.device) {
      if (this.verbose) {
        console.log(`[uDMX Virtual] Transmitidos ${changes.size} canales modificados. Ej:`, Array.from(changes.entries()).slice(0, 5));
      }
      return;
    }

    try {
      const RequestType = 0x40; // Host-to-Device, Vendor, Device
      const SetSingleChannel = 1;
      const SetMultiChannel = 2;

      // Decision logic:
      // If we have very few changes (e.g., less than 5), send them as individual single-channel writes.
      // Otherwise, find the bounding range and send a multi-channel write.
      if (changes.size < 5) {
        for (const [channel, value] of changes.entries()) {
          const index = channel - 1; // 0-indexed for hardware
          
          this.device.controlTransfer(
            RequestType,
            SetSingleChannel,
            value,       // wValue = DMX value
            index,       // wIndex = 0-indexed channel
            Buffer.alloc(0), // No data payload needed for single write
            (err: any) => {
              if (err) {
                console.error(`[uDMX] Error en transferencia de canal único (CH: ${channel}):`, err);
              }
            }
          );
        }
      } else {
        // Multi-channel range optimization
        const channels = Array.from(changes.keys());
        const minCh = Math.min(...channels);
        const maxCh = Math.max(...channels);
        
        const offset = minCh - 1; // Start channel 0-indexed
        const length = maxCh - minCh + 1; // Range length
        
        // Prepare data buffer containing values from fullBuffer for the range [minCh, maxCh]
        const dataBuffer = Buffer.alloc(length);
        for (let i = 0; i < length; i++) {
          dataBuffer[i] = fullBuffer[offset + i];
        }

        this.device.controlTransfer(
          RequestType,
          SetMultiChannel,
          length,      // wValue = range length (number of channels)
          offset,      // wIndex = start channel 0-indexed
          dataBuffer,  // Payload data
          (err: any) => {
            if (err) {
              console.error(`[uDMX] Error en transferencia de rango (CH ${minCh}-${maxCh}):`, err);
            }
          }
        );
      }
    } catch (error) {
      console.error("[uDMX] Error crítico de transmisión USB:", error);
      // Try to recover
      this.isConnected = false;
    }
  }
}

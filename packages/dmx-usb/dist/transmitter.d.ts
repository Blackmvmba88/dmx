export declare class uDMXTransmitter {
    private device;
    private isConnected;
    private vid;
    private pid;
    private verbose;
    constructor(options?: {
        verbose?: boolean;
        vid?: number;
        pid?: number;
    });
    /**
     * Attempt to find and connect to the physical uDMX device.
     * Returns true if successful, false if it defaults to Virtual/Mock mode.
     */
    connect(): boolean;
    /**
     * Close the USB device connection.
     */
    disconnect(): void;
    /**
     * Returns whether the physical USB device is connected.
     */
    getIsConnected(): boolean;
    /**
     * Transmit the modified DMX channels over USB.
     * Uses optimization: if a few channels changed, sends single channel transfers.
     * If many channels changed, sends a single multi-channel range transfer.
     */
    transmitChanges(changes: Map<number, number>, fullBuffer: Uint8Array): void;
}

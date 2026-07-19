#!/usr/bin/env python3
import time
import sys
from pyudmx.pyudmx import uDMXDevice

def clear_screen():
    print("\033[H\033[J", end="")

def blackout(dev):
    print("\n[+] Enviando señal de apagado (Blackout) a los 512 canales...")
    # Send a blackout by writing zeros to all 512 channels.
    # uDMX allows sending range transfers. We can send 512 zeros in chunks if needed,
    # or all at once. Let's do 512 zeros at once.
    try:
        dev.send_multi_value(1, [0] * 512)
        print("[✔] Blackout completado con éxito.")
    except Exception as e:
        print(f"[❌] Error durante blackout: {e}")

def test_single_channel(dev):
    try:
        channel = int(input("\nIntroduce el número de canal DMX (1-512): "))
        if not (1 <= channel <= 512):
            print("[❌] Canal inválido. Debe estar entre 1 y 512.")
            return
        
        value = int(input("Introduce el valor DMX (0-255): "))
        if not (0 <= value <= 255):
            print("[❌] Valor inválido. Debe estar entre 0 y 255.")
            return

        print(f"[+] Enviando valor {value} al canal {channel}...")
        dev.send_single_value(channel, value)
        print("[✔] Valor enviado.")
    except ValueError:
        print("[❌] Por favor introduce números enteros válidos.")
    except Exception as e:
        print(f"[❌] Error al enviar señal DMX: {e}")

def fade_channel(dev):
    try:
        channel = int(input("\nIntroduce el número de canal DMX para el fade (1-512): "))
        if not (1 <= channel <= 512):
            print("[❌] Canal inválido. Debe estar entre 1 y 512.")
            return

        duration = float(input("Introduce la duración del ciclo en segundos (ej. 3.0): "))
        steps = 50
        delay = (duration / 2) / steps

        print(f"[+] Iniciando ciclo de fade en canal {channel} ({duration}s)...")
        
        # Fade up
        print(" -> Subiendo intensidad...")
        for i in range(steps + 1):
            val = int((i / steps) * 255)
            dev.send_single_value(channel, val)
            time.sleep(delay)
            
        # Fade down
        print(" -> Bajando intensidad...")
        for i in range(steps, -1, -1):
            val = int((i / steps) * 255)
            dev.send_single_value(channel, val)
            time.sleep(delay)

        print("[✔] Ciclo de fade completado.")
    except ValueError:
        print("[❌] Por favor introduce valores válidos.")
    except Exception as e:
        print(f"[❌] Error durante el fade: {e}")

def channel_sweep(dev):
    try:
        start_ch = int(input("\nCanal inicial del barrido (1-512, defecto 1): ") or 1)
        end_ch = int(input("Canal final del barrido (1-512, defecto 16): ") or 16)
        
        if not (1 <= start_ch <= end_ch <= 512):
            print("[❌] Rango de canales inválido.")
            return

        print(f"[+] Iniciando barrido del canal {start_ch} al {end_ch}...")
        print("    Presiona Ctrl+C para detener el barrido.")

        # Initialize all channels in range to 0 first
        blackout(dev)

        for ch in range(start_ch, end_ch + 1):
            print(f" -> Probando canal DMX: {ch}")
            # Turn channel on
            dev.send_single_value(ch, 255)
            time.sleep(0.5)
            # Turn channel off
            dev.send_single_value(ch, 0)
            time.sleep(0.1)

        print("[✔] Barrido completado.")
    except KeyboardInterrupt:
        print("\n[-] Barrido interrumpido por el usuario.")
        blackout(dev)
    except ValueError:
        print("[❌] Entrada inválida.")
    except Exception as e:
        print(f"[❌] Error durante el barrido: {e}")

def rgb_demo(dev):
    try:
        print("\n--- Demostración RGB (requiere fixture RGB de 3 canales consecutivos) ---")
        start_ch = int(input("Introduce el canal DMX base (Rojo) (1-510): "))
        if not (1 <= start_ch <= 510):
            print("[❌] Canal inválido.")
            return

        print("[+] Iniciando demo RGB. Presiona Ctrl+C para terminar...")
        
        # Clear color channels
        dev.send_multi_value(start_ch, [0, 0, 0])

        # Colors (R, G, B)
        colors = [
            [255, 0, 0],    # Red
            [0, 255, 0],    # Green
            [0, 0, 255],    # Blue
            [255, 255, 0],  # Yellow
            [0, 255, 255],  # Cyan
            [255, 0, 255],  # Magenta
            [255, 255, 255] # White
        ]

        while True:
            for color in colors:
                print(f" -> Color actual: R:{color[0]} G:{color[1]} B:{color[2]}")
                dev.send_multi_value(start_ch, color)
                time.sleep(1.5)
    except KeyboardInterrupt:
        print("\n[-] Demostración RGB finalizada.")
        # Turn off the RGB channels
        try:
            dev.send_multi_value(start_ch, [0, 0, 0])
        except:
            pass
    except ValueError:
        print("[❌] Entrada inválida.")
    except Exception as e:
        print(f"[❌] Error en demo RGB: {e}")

def main():
    dev = uDMXDevice()
    print("[+] Conectando al dispositivo uDMX Steren...")
    
    if not dev.open():
        print("[❌] No se pudo encontrar o abrir el dispositivo uDMX Steren.")
        print("    Asegúrate de que está conectado por USB.")
        sys.exit(1)

    print("[✔] Dispositivo conectado con éxito!")
    print(f"    Fabricante: {dev.Device.iManufacturer}")
    print(f"    Número de Serie: {dev.Device.iSerialNumber}")

    try:
        while True:
            print("\n==========================================")
            print("     CONTROLADOR DMX STEREN (uDMX)")
            print("==========================================")
            print("1. Enviar valor a canal individual")
            print("2. Probar ciclo de atenuación (Fade)")
            print("3. Barrido de canales (Sweep)")
            print("4. Demostración de color RGB (3 canales)")
            print("5. Apagar todo (Blackout)")
            print("6. Salir")
            print("==========================================")
            
            opcion = input("Elige una opción (1-6): ").strip()
            
            if opcion == "1":
                test_single_channel(dev)
            elif opcion == "2":
                fade_channel(dev)
            elif opcion == "3":
                channel_sweep(dev)
            elif opcion == "4":
                rgb_demo(dev)
            elif opcion == "5":
                blackout(dev)
            elif opcion == "6":
                print("\n[+] Desconectando del dispositivo...")
                blackout(dev)
                break
            else:
                print("[❌] Opción no válida. Por favor, selecciona del 1 al 6.")
                
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n\n[-] Saliendo del programa...")
        try:
            blackout(dev)
        except:
            pass
    finally:
        dev.close()
        print("[✔] Conexión cerrada. ¡Hasta luego!")

if __name__ == "__main__":
    main()

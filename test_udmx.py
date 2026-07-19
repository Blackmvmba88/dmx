import usb.core
import usb.util
import sys

def main():
    # Vendor ID and Product ID for Anyma uDMX
    vendor_id = 0x16c0  # 5824
    product_id = 0x05dc  # 1500

    print(f"Searching for uDMX device (Vendor: 0x{vendor_id:04x}, Product: 0x{product_id:04x})...")
    
    # Find the device
    dev = usb.core.find(idVendor=vendor_id, idProduct=product_id)

    if dev is None:
        print("Device not found. Please make sure the device is plugged in.")
        sys.exit(1)

    print("Device found!")
    print(f"Manufacturer: {usb.util.get_string(dev, dev.iManufacturer)}")
    print(f"Product: {usb.util.get_string(dev, dev.iProduct)}")
    print(f"Serial Number: {usb.util.get_string(dev, dev.iSerialNumber)}")

    # Check configuration
    try:
        # On macOS, it's often already configured or claimed.
        # Let's see if we can print active configuration
        cfg = dev.get_active_configuration()
        print(f"Active configuration: {cfg}")
    except Exception as e:
        print(f"Error reading configuration: {e}")

if __name__ == "__main__":
    main()

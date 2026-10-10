# VOID-NAV prototype · SOS Node1

```
Survivor phone ──Wi-Fi "SOS Node1"──► ESP32 (SOS page at 192.168.4.1)
                                         │ USB cable (stands in for the LoRa radio)
                                         ▼
                              laptop: server.py ──► Command dashboard (SOS Inbox)
       ◄──────── Delivered / Read / Dispatched / Reply go back the same way ────────
```

## 1 · Flash the ESP32 (once)

1. Install the **Arduino IDE**.
   - In **Preferences → Additional boards manager URLs**, add `https://espressif.github.io/arduino-esp32/package_esp32_index.json`.
   - In **Boards Manager**, install **esp32 by Espressif**.
2. Open `firmware/sos_node1/sos_node1.ino`. The `page.h` file next to it must stay in the same folder.
3. Set **Tools → Board → ESP32 Dev Module** and **Tools → Port →** your ESP32's COM port.
4. Click **Upload**. If it hangs on "Connecting…", hold the **BOOT** button on the ESP32 until upload starts.
5. Optional check: open the Serial Monitor at 115200. It should show `# SOS Node1 up` and then a `{"ev":"hello"...}` line every 3 s.
   **Close the Serial Monitor afterwards.** The laptop server needs that port.

Optional parts (same pins as the LoRa firmware):
- Orange LED: GPIO21 → 220 Ω → GND
- Green LED: GPIO22 → 220 Ω → GND
- Push button: GPIO13 ↔ GND

## 2 · Start the command dashboard

- Keep the ESP32 plugged into the laptop by USB.
- Double-click `start.bat`. The first run installs `pyserial`, which needs internet once.
- The dashboard opens at `http://localhost:8800/command`.
- Click **Start console**.
- The top bar shows **SOS Node1 online · LIVE NODE**.

The laptop stays on its normal Wi-Fi. It does **not** join SOS Node1.

## 3 · Send from a phone

1. On the phone, turn **mobile data off**, then join Wi-Fi **SOS Node1** (open, no password).
2. The SOS page opens by itself. If it doesn't, open `http://192.168.4.1` in the browser.
3. Tap **SOS Node1**, choose what happened, and tap **SEND SOS**.
4. It appears in the dashboard **SOS Inbox** with a siren. Open it → the phone shows **Read**. **Dispatch** → **Help dispatched**. **Send reply** → it pops up on the phone.
5. Failure demo: unplug the ESP32's USB. The phone stays at **Sending, try n of 8**. Plug it back in and it shows **Delivered**.

## Without the ESP32

`start_without_esp32.bat` runs the same dashboard with the LoRa link emulated in software. The phone then opens `http://<laptop-IP>:8800/`.

## What is real

- **Phone → ESP32 Wi-Fi → SOS page:** real.
- **Delivery to the laptop:** real. The node retries until the laptop ACKs.
- **Read / Dispatch / Reply back to the phone:** real.
- **Phone Wi-Fi RSSI:** real, measured by the ESP32.
- **LoRa:** the USB cable carries the same messages until the RA-02 is fitted.
- **SemCode:** the team's `semcode.py`.
- **QAOA:** exact port of `qaoa_relays.py`, reproducing Qiskit's 21.08%.
- **Self-healing relays:** simulated.

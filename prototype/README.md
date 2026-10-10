# VOID-NAV rescue kit prototype (2 × ESP32 + 2 × LoRa RA-02)

The search team carries the **rescuer node**. It finds phones by their Wi-Fi signals and builds a heatmap. Survivors join its Wi-Fi and send an SOS, which reaches the command dashboard over LoRa. Read, Dispatch and replies go back to the survivor's phone the same way.

```
 survivor phone ─Wi-Fi "SOS Node1"─► RESCUER NODE (ESP32 #1 + RA-02, power bank)
                                      · SOS page at 192.168.4.1
                                      · counts nearby phones (probe requests, every 20 s)
                                            │  LoRa 433 MHz, SF9  (SOS, phone counts, confirmations)
                                            ▼
                                     COMMAND GATEWAY (ESP32 #2 + RA-02) ─USB─► laptop: server.py ─► dashboard
          ◄──────────── ACK · READ · DISPATCH · REPLY go back the same way ────────────
```

## 1 · Wire both boards (RA-02, same on both)

- **3V3 only. Never 5 V.** 3V3→3.3V, GND→GND, SCK→GPIO18, MISO→GPIO19, MOSI→GPIO23, NSS→GPIO5, RST→GPIO4.
- **Fit the antenna before powering on.**
- Rescuer node only, optional: orange LED on GPIO21, green LED on GPIO22, push button between GPIO13 and GND.

## 2 · Flash (arduino-cli)

Run these in the `firmware` folder:

```
flash.bat rescuer            (board #1, the one the rescuer carries)
flash.bat gateway            (board #2, stays on the laptop's USB)
```

The output should show:
- Rescuer: `# LoRa radio OK` and `# RESCUER NODE UP`.
- Gateway: `# GATEWAY: LoRa radio OK`, then `{"ev":"hello"...}` lines.

If you see `LoRa radio NOT FOUND`, re-check the NSS, RST and 3V3 wires.

**If the LoRa modules don't work:** flash `flash.bat rescuer_usb_only` onto one board and keep it on the laptop's USB. Everything else works the same, with the USB cable carrying the messages in place of LoRa. The dashboard then shows LIVE USB.

## 3 · Run

1. Put the **rescuer node on the power bank**. Unplug it from the laptop.
2. Plug the **gateway into the laptop**. Close any Serial Monitor.
3. Double-click `start.bat`. The dashboard opens at `http://localhost:8800/command`.
4. Click **Start console**. The top bar shows **LoRa gateway online · LIVE LoRa**.

## 4 · Demo

1. **Find people:** the right-hand panel shows **Phones near rescuer** every 20 s. On the **Map**, tap where the rescuer is standing; each scan is painted there as the heatmap.
2. **Connect:** the survivor turns **mobile data off**, joins **SOS Node1**, and the SOS page opens (or `192.168.4.1`).
3. **SOS:** the survivor taps what happened and presses **SEND SOS**. It lands in **SOS Inbox** with a siren, showing the LoRa RSSI/SNR and the phone's Wi-Fi strength.
4. **Respond:**
   - Opening the card shows **Read** on the phone.
   - **Dispatch** shows **Help dispatched** with the team name.
   - **Send reply** pops the message up on the phone.
5. **Failure:** switch the gateway off. The phone stays at **Sending, try n of 8**. Switch it back on and the phone shows **Delivered**.

## Honest labels

- **Phone counts:** these are real Wi-Fi probe requests on the node's channel. Phones randomise their addresses, so the counts are **approximate**. Addresses are hashed in RAM for 20 s, then dropped, and are **never stored or sent**.
- **Rescuer position:** set by tapping the map, because there's no GPS module yet.
- **SemCode, QAOA, self-healing:** see the Network lab and the Real vs simulated tab.

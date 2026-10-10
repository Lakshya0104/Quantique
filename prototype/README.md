# VOID-NAV prototype (Tech Horizon 2.0 demo)

The survivor phone sends an SOS. The rescue command dashboard shows it. Read / Dispatch / Reply go back to the phone.
Python 3 only, no internet, no installs.

## Run

1. Turn on your **phone hotspot** and connect the **laptop** to it, or put both on the same Wi-Fi.
2. Double-click `start.bat` (Windows) or run `./start.sh`.
   The dashboard opens at `http://localhost:8000/command`.
   Click **Start console** to enable the alarm sound and voice.
3. The black server window prints the phone link, e.g. `http://192.168.43.12:8000/`.
   Open it on the phone.
   If Windows asks, click **Allow access** for Python on Private networks.

## The loop (playbook section 11)

| Phone (survivor) | Dashboard (command) |
|---|---|
| Tap **VOID-NAV SOS**, then the connecting animation and tick | |
| Pick what happened, people, injured, bleeding, where, who, needs, note. **SEND SOS** | |
| Sending, try 1 of 8 | Siren, voice alert, red card in **SOS Inbox** |
| **Delivered** (beep) | Open the card: it becomes READ (locked) |
| **Read by rescuer** (orange, beep, vibrate) | **Dispatch** with a team name |
| **Help dispatched** (green, alarm) | **Send reply**, e.g. "Team arriving in 10 min" |
| Reply pops up | |

- **Failure demo:** click **Unplug gateway**, then send from the phone. It stays at "Sending, try n of 8". Click **Plug gateway back in** and it shows Delivered.
- **No-phone SOS:** use **Press beacon push-button** on the emulated beacon node.
- **Network lab:**
  - Semantic meter, using your real SOS.
  - Self-healing simulator: click relays to kill or revive them.
  - **Plan relays (QAOA)**.
- **Field view:** open `http://<laptop-IP>:8000/command` on a rescuer's phone. It shows the inbox with Read / Dispatch only.

## What is real here

- **SemCode** is the team's `semcode.py`, called on every SOS. The token, decoded report and airtime use the Semtech formula.
- **QAOA:**
  - `qaoa.js` is an exact statevector port of `quantum/qaoa_relays.py` (XY mixer, Dicke start, p = 3).
  - It uses the angles the Qiskit run found, from `data/qaoa_result.json`.
  - It reproduces Qiskit's P(optimum) of 21.08% to machine precision.
- **LoRa link:** **EMULATED** while the boards are offline, using the firmware's retry / ACK / 8-try rules. RSSI and SNR are generated and labelled EMULATED.
- **Real gateway:** with a gateway ESP32 on USB, run `python server.py --serial COM5`. This needs `pip install pyserial`.
- **Storage:** every SOS and status change is stored in `voidnav.db` (SQLite).

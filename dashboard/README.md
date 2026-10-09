# VOID-NAV Command: disaster response dashboard

A fully offline 3D command dashboard for the VOID-NAV SOS mesh (Hyderabad example). No internet needed: three.js, fonts and data are bundled.

## Run
1. Double-click `start.bat` (Windows) or run `./start.sh` (Mac/Linux). Needs Python 3.
2. It opens **http://localhost:8000** in your browser. Use **Google Chrome or Edge** (needed for the hardware connection and the best voices).
3. Click **▶ Simulate disaster**.

ES modules don't load from `file://`, so always run it through the local server.

## Tabs
| Tab | What it does |
|---|---|
| **Situation** | 3D Hyderabad: attention heat columns (urgency × people × waiting time, minus help sent), SOS beacons, hospitals, relays with live packets, ambulances. "Attention now" ranks zones; *Focus 3D* flies the camera there. |
| **SOS Inbox** | Critical first. Opening a message marks it **READ** (locked; orange LED on the node). **Confirm rescue dispatched** marks it **DISPATCHED** (green LED). Shows nearest hospitals, beds and ambulance ETAs. |
| **Response** | Hospitals (approximate positions, simulated beds), ambulances, agencies and a coordination log. Links are simulated. |
| **Mesh · Quantum** | Self-healing mesh (click a relay to fail/restore it). **Run QAOA**: CVaR-QAOA (p = 1, 8 qubits, 1024 shots) plans 3 relay sites from the live heat clusters and is checked against the exact answer. **Show plan on 3D map** draws the result. |

## Voice alerts
Critical SOS → siren + spoken alert in English, Hindi and Telugu (Voice selector, top right). Uses the browser's built-in voices. If a Hindi/Telugu voice isn't installed on the laptop, that language is skipped (install via Windows Settings → Time & language → Speech). Click anywhere on the page once first, because browsers block audio until you interact.

## Connect the hardware
Click **⚡ Connect hardware** and choose the ESP32's COM port (115200 baud). The gateway prints **one JSON object per line**:
```
{"type":"sos","id":"A7F3C201","cat":"TRAPPED","prio":0,"injured":"YES","people":3,"text":"leg stuck","rssi":-48,"snr":9.5,"hops":1}
{"type":"hello","node":"R1","hops_to_gw":1,"rssi":-71}
```
Optional `"loc":{"lat":..,"lon":..,"src":"GPS"}`. Without it, the message is placed at a **configured demo location** and labelled as such.
When the rescuer opens or dispatches a live message, the dashboard writes back:
```
{"type":"status","id":"A7F3C201","state":"READ"}
{"type":"status","id":"A7F3C201","state":"DISPATCHED"}
```
Live messages are tagged **LIVE LoRa**; simulated ones are tagged **SIM**.

## URL shortcuts (rehearsal)
`index.html?autosim=1&n=20` starts the simulation with 20 messages (muted) · `&tab=inbox|resources|mesh` · `&qaoa=1`

## Honesty notes
Map positions and bed counts are approximate/simulated; agency links are simulated; phone counts are estimates without identities; QAOA is a statevector simulation (same maths as Qiskit Aer) with no speed-up claimed at this size.

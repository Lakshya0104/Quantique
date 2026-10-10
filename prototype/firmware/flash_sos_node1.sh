#!/bin/sh
# Flash SOS Node1 with arduino-cli (macOS / Linux). Usage: ./flash_sos_node1.sh [port]
set -e; cd "$(dirname "$0")"
arduino-cli config init --overwrite >/dev/null 2>&1 || true
arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core update-index
arduino-cli core list | grep -q "esp32:esp32" || arduino-cli core install esp32:esp32
PORT=${1:-$(arduino-cli board list | awk '/tty(USB|ACM)|cu\.(usbserial|SLAB|wchusb)/{print $1; exit}')}
[ -n "$PORT" ] || { echo "No ESP32 port found"; arduino-cli board list; exit 1; }
arduino-cli compile --fqbn esp32:esp32:esp32 SOS_Node1_single
arduino-cli upload -p "$PORT" --fqbn esp32:esp32:esp32 SOS_Node1_single
arduino-cli monitor -p "$PORT" -c baudrate=115200

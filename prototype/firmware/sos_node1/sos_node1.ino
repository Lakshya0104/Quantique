/*
  VOID-NAV · SOS Node1 (ESP32, LoRa radio not fitted)

  Phone --Wi-Fi "SOS Node1"--> ESP32 --USB serial (stands in for the LoRa link)--> laptop server.py --> dashboard
  Laptop --USB--> ESP32 : ACK / READ / DISPATCH / REPLY  --> the phone's status page updates

  Board  : any ESP32 dev board (ESP32-WROOM-32). Arduino IDE: Tools > Board > "ESP32 Dev Module".
  Library: none beyond the ESP32 core (WiFi, WebServer, DNSServer).
  Optional wiring (same pins as the LoRa firmware):
      orange LED  GPIO21 -> 220R -> GND     (fast blink sending, slow blink delivered, solid read)
      green  LED  GPIO22 -> 220R -> GND     (solid = rescue dispatched)
      push button GPIO13 <-> GND            (one-press SOS, no phone needed)

  Serial protocol, 115200 baud, one line each:
    node -> laptop : {"ev":"hello","node":"N1",...}
                     {"ev":"sos","id":"N1-3F2A-01","node":"N1","try":1,"rssi":-48,"clients":1,"data":{...form...}}
                     {"ev":"status_ack","id":"...","state":"DELIVERED|READ|DISPATCHED|REPLY"}
                     {"ev":"fail","id":"..."}
    laptop -> node : ACK <id> | READ <id> | DISPATCH <id> <team> | REPLY <id> <text>
*/
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include "esp_wifi.h"
#include "page.h"               // the SOS web page (generated from phone.html by build_page.py)

const char* AP_SSID = "SOS Node1";  // open network, no password
const char* NODE_ID = "N1";
const int PIN_ORANGE = 21, PIN_GREEN = 22, PIN_BUTTON = 13;
const uint32_t RETRY_MS = 2500;   // resend an SOS until the laptop ACKs it
const uint8_t MAX_TRIES = 8;

enum St : uint8_t { SENDING, DELIVERED, READ_, DISPATCHED, FAILED };
const char* ST_NAME[] = {"SENDING", "DELIVERED", "READ", "DISPATCHED", "FAILED"};

struct Msg {
  String id, body, team;
  String replies[4];
  uint8_t nrep = 0, tries = 0;
  St st = SENDING;
  uint32_t next = 0;
  int rssi = 0;
};
const int BOX = 12;
Msg box[BOX];
int nbox = 0, seq = 0, latest = -1;

WebServer web(80);
DNSServer dns;
String rx;
uint32_t lastHello = 0, lastBtn = 0;

String jsonEsc(const String& s) {
  String o; o.reserve(s.length() + 8);
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '"' || c == '\\') { o += '\\'; o += c; }
    else if (c == '\n') o += "\\n";
    else if (c == '\r') {}
    else if ((uint8_t)c < 0x20) o += ' ';
    else o += c;
  }
  return o;
}

Msg* findMsg(const String& id) {
  for (int i = 0; i < nbox; i++) if (box[i].id == id) return &box[i];
  return nullptr;
}

int clientRssi(int* clients) {
  wifi_sta_list_t list;
  *clients = 0;
  if (esp_wifi_ap_get_sta_list(&list) != ESP_OK || list.num == 0) return 0;
  *clients = list.num;
  int best = -127;
  for (int i = 0; i < list.num; i++) if (list.sta[i].rssi > best) best = list.sta[i].rssi;
  return best;
}

void transmit(Msg& m) {           // "radio" transmit: one JSON line to the laptop
  m.tries++;
  int clients = 0;
  int r = clientRssi(&clients);
  if (r) m.rssi = r;
  Serial.printf("{\"ev\":\"sos\",\"id\":\"%s\",\"node\":\"%s\",\"try\":%d,\"rssi\":%d,\"clients\":%d,\"data\":%s}\n",
                m.id.c_str(), NODE_ID, m.tries, m.rssi, clients, m.body.c_str());
  m.next = millis() + RETRY_MS;
}

Msg& newMsg(const String& body) {
  int slot;
  if (nbox < BOX) slot = nbox++;
  else {                          // full: overwrite the oldest finished message, else the oldest
    slot = 0;
    for (int i = 0; i < BOX; i++) if (box[i].st != SENDING) { slot = i; break; }
  }
  Msg& m = box[slot];
  m = Msg();
  char id[20];
  snprintf(id, sizeof id, "%s-%04X-%02d", NODE_ID, (unsigned)(esp_random() & 0xFFFF), (++seq) % 100);
  m.id = id; m.body = body; m.st = SENDING;
  latest = slot;
  transmit(m);
  return m;
}

// ---------------- web (captive portal) ----------------
void sendPage() { web.send_P(200, "text/html; charset=utf-8", PAGE); }
void redirect() { web.sendHeader("Location", "http://192.168.4.1/", true); web.send(302, "text/plain", ""); }

void apiSos() {
  String b = web.arg("plain");
  b.trim();
  if (b.length() < 2 || b.length() > 900 || b[0] != '{') { web.send(400, "application/json", "{\"error\":\"bad request\"}"); return; }
  b.replace("\n", " "); b.replace("\r", " ");
  Msg& m = newMsg(b);
  web.send(200, "application/json", "{\"ok\":true,\"id\":\"" + m.id + "\"}");
}

void apiPhone() {
  Msg* m = findMsg(web.arg("id"));
  if (!m) { web.send(404, "application/json", "{\"error\":\"unknown\"}"); return; }
  String o = String("{\"id\":\"") + m->id + "\",\"state\":\"" + ST_NAME[m->st] + "\",\"tries\":" + m->tries + ",\"max\":" + MAX_TRIES +
             ",\"team\":" + (m->st == DISPATCHED ? String("\"") + jsonEsc(m->team) + String("\"") : String("null")) + ",\"replies\":[";
  for (int i = 0; i < m->nrep; i++) o += String(i ? "," : "") + "{\"text\":\"" + jsonEsc(m->replies[i]) + "\"}";
  o += "]}";
  web.send(200, "application/json", o);
}

void apiRetry() {
  String b = web.arg("plain");
  int s = b.indexOf("\"id\":\"");
  if (s >= 0) {
    int e = b.indexOf('"', s + 6);
    Msg* m = findMsg(b.substring(s + 6, e));
    if (m && m->st == FAILED) { m->st = SENDING; m->tries = 0; transmit(*m); }
  }
  web.send(200, "application/json", "{\"ok\":true}");
}

void apiNode() {   // lets the page / laptop check the node is alive
  int c = 0; clientRssi(&c);
  web.send(200, "application/json", String("{\"node\":\"") + NODE_ID + "\",\"ssid\":\"" + AP_SSID + "\",\"clients\":" + c + ",\"queued\":" + nbox + "}");
}

// ---------------- commands from the laptop ----------------
void command(String line) {
  line.trim();
  if (!line.length()) return;
  int sp = line.indexOf(' ');
  String cmd = sp < 0 ? line : line.substring(0, sp);
  String rest = sp < 0 ? "" : line.substring(sp + 1);
  int sp2 = rest.indexOf(' ');
  String id = sp2 < 0 ? rest : rest.substring(0, sp2);
  String arg = sp2 < 0 ? "" : rest.substring(sp2 + 1);
  if (cmd == "PING") { Serial.println("{\"ev\":\"pong\"}"); return; }
  Msg* m = findMsg(id);
  if (!m) { Serial.printf("{\"ev\":\"error\",\"msg\":\"unknown id %s\"}\n", jsonEsc(id).c_str()); return; }
  String state;
  if (cmd == "ACK") { if (m->st == SENDING || m->st == FAILED) m->st = DELIVERED; state = "DELIVERED"; }
  else if (cmd == "READ") { if (m->st == DELIVERED || m->st == SENDING) m->st = READ_; state = "READ"; }
  else if (cmd == "DISPATCH") { m->st = DISPATCHED; m->team = arg.length() ? arg : "Rescue team"; state = "DISPATCHED"; }
  else if (cmd == "REPLY") {
    bool dup = false;
    for (int i = 0; i < m->nrep; i++) if (m->replies[i] == arg) dup = true;   // laptop may resend
    if (!dup && arg.length()) {
      if (m->nrep == 4) { for (int i = 0; i < 3; i++) m->replies[i] = m->replies[i + 1]; m->nrep = 3; }
      m->replies[m->nrep++] = arg;
    }
    state = "REPLY";
  } else { Serial.println("{\"ev\":\"error\",\"msg\":\"commands: ACK|READ|DISPATCH|REPLY <id> [text]\"}"); return; }
  Serial.printf("{\"ev\":\"status_ack\",\"id\":\"%s\",\"state\":\"%s\"}\n", m->id.c_str(), state.c_str());
}

// ---------------- LEDs ----------------
void leds() {
  bool o = false, g = false;
  if (latest >= 0) {
    St s = box[latest].st;
    uint32_t t = millis();
    if (s == SENDING) o = (t / 150) % 2;
    else if (s == DELIVERED) o = (t / 600) % 2;
    else if (s == READ_) o = true;
    else if (s == DISPATCHED) { o = true; g = true; }
  }
  digitalWrite(PIN_ORANGE, o);
  digitalWrite(PIN_GREEN, g);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_ORANGE, OUTPUT); pinMode(PIN_GREEN, OUTPUT); pinMode(PIN_BUTTON, INPUT_PULLUP);
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
  WiFi.softAP(AP_SSID, nullptr, 6, 0, 8);          // open, channel 6, visible, up to 8 phones
  dns.start(53, "*", IPAddress(192, 168, 4, 1));   // every name resolves to the node: captive portal
  web.on("/", sendPage);
  web.on("/sos", sendPage);
  web.on("/generate_204", redirect);               // Android "sign in to network" pop-up
  web.on("/hotspot-detect.html", redirect);        // iPhone
  web.on("/connecttest.txt", redirect);            // Windows
  web.on("/api/sos", HTTP_POST, apiSos);
  web.on("/api/phone", HTTP_GET, apiPhone);
  web.on("/api/retry", HTTP_POST, apiRetry);
  web.on("/api/node", HTTP_GET, apiNode);
  web.onNotFound(redirect);
  web.begin();
  Serial.printf("# SOS Node1 up: join Wi-Fi \"%s\", open http://192.168.4.1\n", AP_SSID);
}

void loop() {
  dns.processNextRequest();
  web.handleClient();
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') { command(rx); rx = ""; }
    else if (rx.length() < 200) rx += c;
  }
  uint32_t now = millis();
  for (int i = 0; i < nbox; i++) {
    Msg& m = box[i];
    if (m.st == SENDING && (int32_t)(now - m.next) >= 0) {
      if (m.tries >= MAX_TRIES) { m.st = FAILED; Serial.printf("{\"ev\":\"fail\",\"id\":\"%s\"}\n", m.id.c_str()); }
      else transmit(m);
    }
  }
  if (digitalRead(PIN_BUTTON) == LOW && now - lastBtn > 1500) {
    lastBtn = now;
    newMsg("{\"cat\":\"TRAPPED\",\"people\":1,\"button\":true,\"injured\":\"unsure\",\"note\":\"push button on SOS Node1\",\"lang\":\"en\"}");
  }
  if (now - lastHello > 3000) {
    lastHello = now;
    int c = 0; clientRssi(&c);
    Serial.printf("{\"ev\":\"hello\",\"node\":\"%s\",\"ssid\":\"%s\",\"clients\":%d,\"up_s\":%lu}\n", NODE_ID, AP_SSID, c, (unsigned long)(now / 1000));
  }
  leds();
}

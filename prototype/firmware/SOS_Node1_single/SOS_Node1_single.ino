// =====================================================================
//  VOID-NAV · SOS Node1  (single file: paste into Arduino IDE and Upload)
//  Board: "ESP32 Dev Module"   Baud: 115200
//  Phone joins Wi-Fi "SOS Node1" -> page at http://192.168.4.1
//  SOS goes to the laptop over USB (server.py --node shows it in SOS Inbox)
// =====================================================================
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include "esp_wifi.h"

const char* AP_SSID = "SOS Node1";
const char* NODE_ID = "N1";
const int PIN_ORANGE = 21, PIN_GREEN = 22, PIN_BUTTON = 13, PIN_BOARD_LED = 2;
const uint32_t RETRY_MS = 2500;
const uint8_t MAX_TRIES = 8;

const char PAGE[] PROGMEM = R"HTML(<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>SOS Node1</title>
<style>
body{margin:0;background:#0a0f1a;color:#f1f5ff;font-family:system-ui,sans-serif}
.w{max-width:480px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:12px}
h1{margin:4px 0;font-size:26px}small{color:#8a9ab3}
.g{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
button{font:inherit;color:#f1f5ff;background:#121a29;border:1px solid #22304a;border-radius:12px;padding:12px;font-size:15px}
.on{border-color:#ff3b5c!important;background:#3a1220!important}
.row{display:flex;justify-content:space-between;align-items:center;background:#121a29;border-radius:12px;padding:10px 12px}
.row b{font-size:22px;min-width:30px;text-align:center}
textarea{font:16px system-ui;background:#121a29;color:#fff;border:1px solid #22304a;border-radius:12px;padding:10px;min-height:70px}
.send{background:#ff3b5c;border:0;font-size:21px;font-weight:800;padding:18px}
.st{padding:12px;border-radius:12px;background:#121a29;opacity:.35;font-size:17px}.st.ok{opacity:1;border-left:6px solid #2fe08a}
.rep{padding:12px;border-radius:12px;border:1px solid #2fe08a;background:#0f2a1d}
#err{color:#ff8fa3;text-align:center}
</style></head><body><div class="w" id="form">
<div style="color:#2fe08a;font-size:13px">● Connected to SOS Node1 · no internet needed</div>
<h1>Send SOS<br><small>A rescue team will see this. No name or number is collected.</small></h1>
<b>What happened?</b>
<div class="g" id="cats"></div>
<div class="row"><span>People with you</span><span><button id="m">−</button> <b id="pv">1</b> <button id="p">+</button></span></div>
<div class="row"><span>Anyone injured?</span><button id="inj">No</button></div>
<div class="row"><span>Bleeding?</span><button id="bl">No</button></div>
<textarea id="note" maxlength="140" placeholder="Short note: floor, landmark, condition"></textarea>
<div id="err"></div><button class="send" id="send">SEND SOS</button></div>
<div class="w" id="stat" hidden>
<h1 id="hd">Sending…</h1><small id="sid"></small>
<div class="st" id="s0">1 · Sending <small id="tr"></small></div>
<div class="st" id="s1">2 · Delivered to command post</div>
<div class="st" id="s2">3 · Read by rescuer</div>
<div class="st" id="s3">4 · Help dispatched <small id="tm"></small></div>
<div id="reps"></div>
<div class="st ok" style="opacity:1">Stay where you are · save battery · tap metal if you hear rescuers</div>
<button id="rt" hidden>Try sending again</button><button id="again">Send another SOS</button></div>
<script>
var $=function(s){return document.querySelector(s)};
var C=[["TRAPPED","🧱 Trapped"],["COLLAPSE","🏚 Collapse"],["MEDICAL","🩺 Medical"],["FIRE","🔥 Fire"],["FLOOD","🌊 Flood"],["FOOD_WATER","💧 Food/water"],["SHELTER","⛺ Shelter"],["SAFE","✅ I am safe"],["OTHER","❔ Other"]];
var F={cat:null,people:1,injured:"no",bleeding:"no"},id=null,last="",seen=0,t=null;
$("#cats").innerHTML=C.map(function(c){return '<button data-v="'+c[0]+'">'+c[1]+'</button>'}).join("");
$("#cats").onclick=function(e){var b=e.target.closest("button");if(!b)return;F.cat=b.dataset.v;[].forEach.call($("#cats").children,function(x){x.classList.toggle("on",x===b)})};
$("#m").onclick=function(){F.people=Math.max(1,F.people-1);$("#pv").textContent=F.people};
$("#p").onclick=function(){F.people=Math.min(99,F.people+1);$("#pv").textContent=F.people};
function tog(k,el){el.onclick=function(){F[k]=F[k]=="no"?"yes":"no";el.textContent=F[k]=="yes"?"Yes":"No";el.classList.toggle("on",F[k]=="yes")}}
tog("injured",$("#inj"));tog("bleeding",$("#bl"));
var ac;function beep(f,d){try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();var o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f;o.type="square";g.gain.value=.25;o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}}
function vib(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}
$("#send").onclick=function(){if(!F.cat){$("#err").textContent="Tap what happened first.";return}beep(880,.1);
 var body=JSON.stringify({cat:F.cat,people:F.people,injured:F.injured,bleeding:F.bleeding,note:$("#note").value.trim(),lang:"en"});
 fetch("/api/sos",{method:"POST",headers:{"Content-Type":"application/json"},body:body}).then(function(r){return r.json()}).then(function(j){id=j.id;last="";seen=0;$("#reps").innerHTML="";$("#form").hidden=true;$("#stat").hidden=false;poll()}).catch(function(){$("#err").textContent="Node not reachable. Stay on SOS Node1 Wi-Fi."})};
function poll(){clearTimeout(t);if(!id)return;fetch("/api/phone?id="+id).then(function(r){return r.json()}).then(function(j){
 var o=["SENDING","DELIVERED","READ","DISPATCHED"],k=j.state=="FAILED"?0:o.indexOf(j.state);
 for(var i=0;i<4;i++)$("#s"+i).classList.toggle("ok",i<=k);
 $("#sid").textContent="SOS "+j.id;$("#tr").textContent=j.state=="SENDING"?"try "+j.tries+" of "+j.max:j.state=="FAILED"?"not delivered yet":"";
 $("#hd").textContent={SENDING:"Sending…",DELIVERED:"Delivered",READ:"Read by rescuer",DISPATCHED:"Help is on the way",FAILED:"Not delivered yet"}[j.state];
 if(j.team)$("#tm").textContent="· "+j.team;$("#rt").hidden=j.state!="FAILED";
 if(last&&last!=j.state){beep(j.state=="DISPATCHED"?1318:988,.3);vib([200,100,200])}last=j.state;
 if(j.replies.length>seen){for(var i=seen;i<j.replies.length;i++){var d=document.createElement("div");d.className="rep";d.textContent="Rescue command: "+j.replies[i].text;$("#reps").appendChild(d)}if(seen||last)beep(1046,.3);vib(300);seen=j.replies.length}
}).catch(function(){});t=setTimeout(poll,1000)}
$("#rt").onclick=function(){fetch("/api/retry",{method:"POST",body:JSON.stringify({id:id})}).then(poll)};
$("#again").onclick=function(){clearTimeout(t);id=null;$("#stat").hidden=true;$("#form").hidden=false;$("#note").value=""};
</script></body></html>)HTML";

enum St : uint8_t { SENDING, DELIVERED, READ_, DISPATCHED, FAILED };
const char* ST_NAME[] = {"SENDING", "DELIVERED", "READ", "DISPATCHED", "FAILED"};
struct Msg { String id, body, team; String replies[4]; uint8_t nrep = 0, tries = 0; St st = SENDING; uint32_t next = 0; int rssi = 0; };
const int BOX = 12;
Msg box[BOX];
int nbox = 0, seq = 0, latest = -1;
WebServer web(80);
DNSServer dns;
String rx;
uint32_t lastHello = 0, lastBtn = 0;

String jsonEsc(const String& s) {
  String o;
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '"' || c == '\\') { o += '\\'; o += c; }
    else if ((uint8_t)c < 0x20) o += ' ';
    else o += c;
  }
  return o;
}
Msg* findMsg(const String& id) { for (int i = 0; i < nbox; i++) if (box[i].id == id) return &box[i]; return nullptr; }
int clientRssi(int* clients) {
  wifi_sta_list_t list; *clients = 0;
  if (esp_wifi_ap_get_sta_list(&list) != ESP_OK || list.num == 0) return 0;
  *clients = list.num; int best = -127;
  for (int i = 0; i < list.num; i++) if (list.sta[i].rssi > best) best = list.sta[i].rssi;
  return best;
}
void transmit(Msg& m) {
  m.tries++; int c = 0; int r = clientRssi(&c); if (r) m.rssi = r;
  Serial.printf("{\"ev\":\"sos\",\"id\":\"%s\",\"node\":\"%s\",\"try\":%d,\"rssi\":%d,\"clients\":%d,\"data\":%s}\n",
                m.id.c_str(), NODE_ID, m.tries, m.rssi, c, m.body.c_str());
  m.next = millis() + RETRY_MS;
}
Msg& newMsg(const String& body) {
  int slot;
  if (nbox < BOX) slot = nbox++;
  else { slot = 0; for (int i = 0; i < BOX; i++) if (box[i].st != SENDING) { slot = i; break; } }
  Msg& m = box[slot]; m = Msg();
  char id[20]; snprintf(id, sizeof id, "%s-%04X-%02d", NODE_ID, (unsigned)(esp_random() & 0xFFFF), (++seq) % 100);
  m.id = id; m.body = body; latest = slot; transmit(m); return m;
}
void sendPage() { web.send_P(200, "text/html; charset=utf-8", PAGE); }
void redirect() { web.sendHeader("Location", "http://192.168.4.1/", true); web.send(302, "text/plain", ""); }
void apiSos() {
  String b = web.arg("plain"); b.trim();
  if (b.length() < 2 || b.length() > 900 || b[0] != '{') { web.send(400, "application/json", "{\"error\":\"bad request\"}"); return; }
  b.replace("\n", " "); b.replace("\r", " ");
  Msg& m = newMsg(b);
  web.send(200, "application/json", String("{\"ok\":true,\"id\":\"") + m.id + "\"}");
}
void apiPhone() {
  Msg* m = findMsg(web.arg("id"));
  if (!m) { web.send(404, "application/json", "{\"error\":\"unknown\"}"); return; }
  String o = String("{\"id\":\"") + m->id + "\",\"state\":\"" + ST_NAME[m->st] + "\",\"tries\":" + m->tries + ",\"max\":" + MAX_TRIES + ",\"team\":";
  o += (m->st == DISPATCHED) ? String("\"") + jsonEsc(m->team) + String("\"") : String("null");
  o += ",\"replies\":[";
  for (int i = 0; i < m->nrep; i++) { if (i) o += ","; o += String("{\"text\":\"") + jsonEsc(m->replies[i]) + "\"}"; }
  o += "]}";
  web.send(200, "application/json", o);
}
void apiRetry() {
  String b = web.arg("plain"); int s = b.indexOf("\"id\":\"");
  if (s >= 0) { int e = b.indexOf('"', s + 6); Msg* m = findMsg(b.substring(s + 6, e)); if (m && m->st == FAILED) { m->st = SENDING; m->tries = 0; transmit(*m); } }
  web.send(200, "application/json", "{\"ok\":true}");
}
void command(String line) {
  line.trim(); if (!line.length()) return;
  int sp = line.indexOf(' ');
  String cmd = sp < 0 ? line : line.substring(0, sp), rest = sp < 0 ? "" : line.substring(sp + 1);
  int sp2 = rest.indexOf(' ');
  String id = sp2 < 0 ? rest : rest.substring(0, sp2), arg = sp2 < 0 ? "" : rest.substring(sp2 + 1);
  if (cmd == "PING") { Serial.println("{\"ev\":\"pong\"}"); return; }
  Msg* m = findMsg(id);
  if (!m) { Serial.printf("{\"ev\":\"error\",\"msg\":\"unknown id %s\"}\n", jsonEsc(id).c_str()); return; }
  String state;
  if (cmd == "ACK") { if (m->st == SENDING || m->st == FAILED) m->st = DELIVERED; state = "DELIVERED"; }
  else if (cmd == "READ") { if (m->st == DELIVERED || m->st == SENDING) m->st = READ_; state = "READ"; }
  else if (cmd == "DISPATCH") { m->st = DISPATCHED; m->team = arg.length() ? arg : "Rescue team"; state = "DISPATCHED"; }
  else if (cmd == "REPLY") {
    bool dup = false; for (int i = 0; i < m->nrep; i++) if (m->replies[i] == arg) dup = true;
    if (!dup && arg.length()) { if (m->nrep == 4) { for (int i = 0; i < 3; i++) m->replies[i] = m->replies[i + 1]; m->nrep = 3; } m->replies[m->nrep++] = arg; }
    state = "REPLY";
  } else return;
  Serial.printf("{\"ev\":\"status_ack\",\"id\":\"%s\",\"state\":\"%s\"}\n", m->id.c_str(), state.c_str());
}
void leds() {
  bool o = false, g = false; uint32_t t = millis();
  if (latest >= 0) { St s = box[latest].st;
    if (s == SENDING) o = (t / 150) % 2; else if (s == DELIVERED) o = (t / 600) % 2; else if (s == READ_) o = true; else if (s == DISPATCHED) { o = true; g = true; } }
  digitalWrite(PIN_ORANGE, o); digitalWrite(PIN_GREEN, g);
  digitalWrite(PIN_BOARD_LED, latest < 0 ? ((t / 1000) % 2) : o);   // on-board LED: slow blink = node alive
}

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(PIN_ORANGE, OUTPUT); pinMode(PIN_GREEN, OUTPUT); pinMode(PIN_BOARD_LED, OUTPUT); pinMode(PIN_BUTTON, INPUT_PULLUP);
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
  bool ok = WiFi.softAP(AP_SSID);             // open network, no password
  dns.start(53, "*", IPAddress(192, 168, 4, 1));
  web.on("/", sendPage); web.on("/sos", sendPage);
  web.on("/generate_204", redirect); web.on("/hotspot-detect.html", redirect); web.on("/connecttest.txt", redirect);
  web.on("/api/sos", HTTP_POST, apiSos); web.on("/api/phone", HTTP_GET, apiPhone); web.on("/api/retry", HTTP_POST, apiRetry);
  web.onNotFound(redirect);
  web.begin();
  Serial.printf("# SOS Node1 %s: join Wi-Fi \"%s\", open http://%s\n", ok ? "UP" : "FAILED TO START", AP_SSID, WiFi.softAPIP().toString().c_str());
}

void loop() {
  dns.processNextRequest();
  web.handleClient();
  while (Serial.available()) { char c = Serial.read(); if (c == '\n') { command(rx); rx = ""; } else if (rx.length() < 200) rx += c; }
  uint32_t now = millis();
  for (int i = 0; i < nbox; i++) { Msg& m = box[i];
    if (m.st == SENDING && (int32_t)(now - m.next) >= 0) {
      if (m.tries >= MAX_TRIES) { m.st = FAILED; Serial.printf("{\"ev\":\"fail\",\"id\":\"%s\"}\n", m.id.c_str()); } else transmit(m); } }
  if (digitalRead(PIN_BUTTON) == LOW && now - lastBtn > 1500) { lastBtn = now;
    newMsg("{\"cat\":\"TRAPPED\",\"people\":1,\"button\":true,\"injured\":\"unsure\",\"note\":\"push button on SOS Node1\",\"lang\":\"en\"}"); }
  if (now - lastHello > 3000) { lastHello = now; int c = 0; clientRssi(&c);
    Serial.printf("{\"ev\":\"hello\",\"node\":\"%s\",\"ssid\":\"%s\",\"clients\":%d,\"up_s\":%lu}\n", NODE_ID, AP_SSID, c, (unsigned long)(now / 1000)); }
  leds();
}

"""VOID-NAV command server (prototype).

    python server.py                 # LoRa link EMULATED in software (hardware offline)
    python server.py --serial COM5   # real gateway ESP32 on USB (firmware JSON lines)

Serves:
  /            survivor SOS page (what the beacon node's captive portal shows)
  /command     rescue command dashboard (desktop) / field view (phone width)
Stores every SOS and status change in SQLite (voidnav.db). Standard library only
(pyserial is needed only for --serial).

Emulated link: the beacon node's retry/ACK rules from the firmware run here. An SOS is
retried every RETRY_S seconds until the gateway ACKs it; after MAX_TRIES it is marked
"not delivered". Read / Dispatch / Reply are resent until the node confirms them.
"Unplug gateway" on the dashboard cuts the emulated link so failures are visible.
RSSI/SNR in emulated mode are generated and labelled EMULATED, never presented as measured.
"""
import argparse, json, os, random, socket, sqlite3, sys, threading, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import semcode as sc  # noqa: E402  (team's SemCode codebook + airtime maths)

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT, RETRY_S, MAX_TRIES, HEADER = 8800, 2.5, 8, 10
LOCK = threading.RLock()
T0 = time.time()                          # "event" time for minutes-since-event
NODE = {"id": "N1", "name": "Beacon node N1", "lat": 17.4127, "lon": 78.5083, "where": "Musheerabad (configured, no GPS)"}
S = {"link": True, "mode": "EMULATED", "seq": 0, "msgs": {}, "order": [], "events": [], "serial": None}
CAT_URG = {"TRAPPED": 6, "COLLAPSE": 6, "FIRE": 6, "MEDICAL": 5, "FLOOD": 5, "FOOD_WATER": 2, "SHELTER": 1, "SAFE": 0, "OTHER": 2}

db = sqlite3.connect(os.path.join(ROOT, "voidnav.db"), check_same_thread=False)
db.execute("create table if not exists sos(id text primary key, t real, json text)")
db.execute("create table if not exists events(seq integer, t real, kind text, json text)")
db.commit()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1)); return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def all_ips():
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    ips.add(lan_ip())
    return sorted(i for i in ips if not i.startswith("127."))


def emit(kind, **data):
    with LOCK:
        S["seq"] += 1
        ev = {"seq": S["seq"], "t": time.time(), "kind": kind, **data}
        S["events"].append(ev); S["events"] = S["events"][-500:]
        db.execute("insert into events values(?,?,?,?)", (ev["seq"], ev["t"], kind, json.dumps(data, ensure_ascii=False)))
        db.commit()
    return ev


def save(m):
    db.execute("insert or replace into sos values(?,?,?)", (m["id"], m["t"], json.dumps(m, ensure_ascii=False))); db.commit()


def people_bucket(n):
    n = int(n)
    return "1" if n <= 1 else "2" if n == 2 else "3-5" if n <= 5 else "6-10" if n <= 10 else "11-20" if n <= 20 else "20+"


def triage(form):
    """Form taps + free-text keyword triage -> SemCode fields (runs on the beacon node)."""
    tri = {"no": 0, "yes": 1, "unsure": 2}
    cat = form.get("cat", "OTHER") if form.get("cat") in sc.CATS else "OTHER"
    f = {"cat": cat, "injured": tri.get(form.get("injured", "unsure"), 2), "bleeding": tri.get(form.get("bleeding", "no"), 0),
         "people": people_bucket(form.get("people", 1)), "pos": form.get("pos") if form.get("pos") in sc.POS else "UNKNOWN",
         "vuln": {v for v in form.get("vuln", []) if v in sc.VULN}, "needs": {v for v in form.get("needs", []) if v in sc.NEEDS},
         "urgency": CAT_URG.get(cat, 2), "minutes": int((time.time() - T0) / 60)}
    if f["injured"] == 1: f["urgency"] += 3
    if f["bleeding"] == 1: f["urgency"] += 3
    if f["vuln"]: f["urgency"] += 1
    if int(form.get("people", 1)) >= 3: f["urgency"] += 1
    f["urgency"] = min(15, f["urgency"])
    sc.triage_text(form.get("note", ""), f)
    if form.get("button"): f["urgency"] = 15
    return f


def new_sos(form, mid=None, live=False):
    f = triage(form)
    tok = sc.encode(f); d = sc.decode(tok)
    note = str(form.get("note", ""))[:160]
    # what the same SOS would cost as free text (taps spelled out + note), for the semantic meter
    words = f"SOS {d['cat']} {form.get('people', 1)} people {d['pos']} injured {d['injured']} bleeding {d['bleeding']} " \
            f"{' '.join(d['vuln'])} needs {' '.join(d['needs'])} {note}".strip()
    text_b = len(words.encode()) + HEADER
    tok_b = len(tok) + HEADER
    prio = 0 if (d["urgency"] >= 10 or form.get("button")) else 1 if d["urgency"] >= 5 else 2
    try: ppl = max(1, int(form.get("people", 1)))
    except (TypeError, ValueError): ppl = 1
    with LOCK:
        n = len(S["order"]) + 1
        mid = mid or f"{random.randint(0x1000, 0xFFFF):04X}-{n:03d}"
        m = {"id": mid, "t": time.time(), "node": NODE["id"], "prio": prio, "token": tok.hex(), "decoded": d,
             "report": sc.report(d), "note": note, "lang": form.get("lang", "en"), "people_n": ppl,
             "button": bool(form.get("button")), "state": "SENDING", "tries": 0, "next_try": time.time() + 0.6,
             "rssi": None, "snr": None, "hops": None, "delivered_t": None, "team": None, "replies": [],
             "down": [], "status_confirmed": None, "live": live,
             "meter": {"text_bytes": text_b, "token_bytes": tok_b, "text_ms": round(sc.airtime_ms(text_b), 1),
                       "token_ms": round(sc.airtime_ms(tok_b), 1), "words": words}}
        S["msgs"][mid] = m; S["order"].append(mid)
    save(m)
    if not live:
        emit("node", id=mid, msg=f"Beacon node queued SOS {mid} (P{prio}) · token {tok.hex()}")
    return m


def public(m):
    return {k: v for k, v in m.items() if k not in ("next_try",)}


def apply_status(m, kind, text, now):
    if kind == "READ" and m["state"] in ("DELIVERED",):
        m["state"] = "READ"
    elif kind == "DISPATCH":
        m["state"] = "DISPATCHED"
    elif kind == "REPLY":
        m["replies"].append({"t": now, "text": text})
    m["status_confirmed"] = True


def ser_write(line):
    ser = S["serial"]
    if not ser:
        return False
    try:
        ser.write((line + "\n").encode("utf-8")); return True
    except Exception as e:
        emit("log", msg=f"USB write failed: {e}"); return False


# ---------------- link loop: emulated LoRa, or downlink retries to the real node ----------------
def radio_loop():
    while True:
        time.sleep(0.2)
        now = time.time()
        with LOCK:
            for mid in list(S["order"]):
                m = S["msgs"][mid]
                if not m["live"] and m["state"] == "SENDING" and now >= m["next_try"]:
                    m["tries"] += 1
                    if S["link"]:
                        m["state"] = "DELIVERED"; m["delivered_t"] = now
                        m["rssi"] = random.randint(-72, -54); m["snr"] = round(random.uniform(6.0, 10.5), 1); m["hops"] = 1
                        save(m)
                        emit("sos", id=mid, msg=public(m))
                        emit("node", id=mid, msg=f"Gateway ACK {mid} (try {m['tries']}) · RSSI {m['rssi']} dBm [EMULATED]")
                    elif m["tries"] >= MAX_TRIES:
                        m["state"] = "FAILED"; save(m)
                        emit("node", id=mid, msg=f"{mid} not delivered after {MAX_TRIES} tries (gateway unreachable)")
                    else:
                        m["next_try"] = now + RETRY_S
                        emit("node", id=mid, msg=f"{mid} try {m['tries']}/{MAX_TRIES}: no ACK, retrying")
                # downlink: status / replies resent until the node confirms
                for d in m["down"]:
                    if d["ok"] or now < d["next"]:
                        continue
                    if d["tries"] >= MAX_TRIES:
                        d["ok"] = "failed"; m["status_confirmed"] = False; save(m)
                        emit("status_fail", id=mid, state=d["kind"], msg=f"{d['kind']} for {mid} not confirmed at node")
                        continue
                    d["tries"] += 1; d["next"] = now + RETRY_S
                    if m["live"]:      # real node: send the command, wait for its status_ack
                        cmd = {"READ": "READ", "DISPATCH": "DISPATCH", "REPLY": "REPLY"}[d["kind"]]
                        ser_write(f"{cmd} {mid}" + (f" {d['text']}" if d["text"] else ""))
                    elif S["link"]:
                        d["ok"] = True; apply_status(m, d["kind"], d["text"], now); save(m)
                        emit("status_ack", id=mid, state=d["kind"], msg=f"Node confirmed {d['kind']} for {mid}")


def downlink(mid, kind, text=""):
    text = " ".join(str(text).split())[:120]
    with LOCK:
        m = S["msgs"].get(mid)
        if not m:
            return False
        if kind == "READ" and (m["state"] != "DELIVERED" or any(d["kind"] == "READ" for d in m["down"])):
            return True                                   # Read is one-way and happens once
        if kind == "DISPATCH" and (m["state"] == "DISPATCHED" or any(d["kind"] == "DISPATCH" and d["ok"] is not True for d in m["down"])):
            return True
        m["down"].append({"kind": kind, "text": text, "tries": 0, "next": time.time(), "ok": False})
        if kind == "DISPATCH": m["team"] = text or "Rescue team"
        m["status_confirmed"] = None; save(m)
    emit("status", id=mid, state=kind, text=text, msg=f"Command → {kind} {mid}{(' · ' + text) if text else ''}")
    return True


# ---------------- real SOS node on USB (ESP32 running firmware/sos_node1) ----------------
KNOWN_USB = (0x10C4, 0x1A86, 0x0403, 0x303A, 0x2341)   # CP210x, CH340, FTDI, Espressif, Arduino


def find_port():
    from serial.tools import list_ports
    ports = list(list_ports.comports())
    for p in ports:
        if p.vid in KNOWN_USB or any(k in (p.description or "") for k in ("CP210", "CH340", "CH910", "USB-SERIAL", "USB Serial", "UART")):
            return p.device
    return None


def on_line(line):
    if not line.startswith("{"):
        if line.startswith("#"): emit("log", msg="node: " + line[1:].strip())
        return
    try: j = json.loads(line)
    except ValueError: return
    S["node_seen"] = time.time()
    ev = j.get("ev")
    if ev == "hello":
        if not S["link"]:
            S["link"] = True; emit("link", up=True, msg=f"SOS Node1 online · {j.get('clients', 0)} phone(s) on its Wi-Fi")
        S["clients"] = j.get("clients", 0)
    elif ev == "sos":
        mid = str(j.get("id", ""))[:20]
        with LOCK:
            known = mid in S["msgs"]
        ser_write(f"ACK {mid}")                          # always ACK (also re-ACK a retried duplicate)
        if known:
            emit("log", msg=f"duplicate {mid} (node retried) · re-ACKed"); return
        form = j.get("data") if isinstance(j.get("data"), dict) else {}
        m = new_sos(form, mid=mid, live=True)
        with LOCK:
            m.update(state="DELIVERED", tries=j.get("try", 1), rssi=j.get("rssi") or None, hops=1, delivered_t=time.time())
        save(m)
        emit("sos", id=mid, msg=public(m))
        emit("node", id=mid, msg=f"SOS {mid} from SOS Node1 (try {j.get('try', 1)}) · phone Wi-Fi RSSI {j.get('rssi')} dBm · ACK sent")
    elif ev == "status_ack":
        mid, st = j.get("id"), j.get("state")
        kind = {"READ": "READ", "DISPATCHED": "DISPATCH", "REPLY": "REPLY"}.get(st)
        if not kind: return
        with LOCK:
            m = S["msgs"].get(mid)
            if not m: return
            d = next((d for d in m["down"] if d["kind"] == kind and d["ok"] is not True), None)
            if not d: return
            d["ok"] = True; apply_status(m, kind, d["text"], time.time()); save(m)
        emit("status_ack", id=mid, state=kind, msg=f"SOS Node1 confirmed {kind} for {mid}")
    elif ev == "fail":
        emit("node", id=j.get("id"), msg=f"node gave up on {j.get('id')} after 8 tries")


def serial_loop(port_arg):
    try:
        import serial  # pyserial
    except ImportError:
        print("\n  pyserial is missing. Run:  pip install pyserial   then start again.\n"); return
    S["mode"] = "LIVE"; S["link"] = False
    warned = False
    while True:
        port = port_arg or find_port()
        if not port:
            if not warned: emit("link", up=False, msg="Waiting for SOS Node1 on USB…"); print("  Waiting for the ESP32 on USB..."); warned = True
            time.sleep(2); continue
        try:
            ser = serial.Serial(); ser.port = port; ser.baudrate = 115200; ser.timeout = 0.5
            try: ser.dtr = False; ser.rts = False            # do not reset / hold the ESP32 in boot mode
            except Exception: pass
            try: ser.open()
            except Exception:
                ser = serial.Serial(port, 115200, timeout=0.5)
        except Exception as e:
            if not warned: print(f"  Cannot open {port}: {e}  (close Arduino Serial Monitor)"); warned = True
            time.sleep(2); continue
        warned = False
        S["serial"] = ser; S["port"] = port
        print(f"  SOS Node1 connected on {port}")
        emit("log", msg=f"SOS Node1 on {port} · LIVE")
        buf = b""
        try:
            while True:
                chunk = ser.read(256)
                if chunk:
                    buf += chunk
                    while b"\n" in buf:
                        line, buf = buf.split(b"\n", 1)
                        on_line(line.decode("utf-8", errors="replace").strip())
                if S["link"] and time.time() - S.get("node_seen", 0) > 8:
                    S["link"] = False; emit("link", up=False, msg="SOS Node1 silent: link down")
        except Exception as e:
            print(f"  SOS Node1 disconnected ({e})")
        S["serial"] = None; S["link"] = False
        emit("link", up=False, msg="SOS Node1 unplugged: link down")
        try: ser.close()
        except Exception: pass
        time.sleep(1)


# ---------------- HTTP ----------------
class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        try: return json.loads(self.rfile.read(n) or b"{}")
        except ValueError: return {}

    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path in ("/", "/sos", "/generate_204", "/hotspot-detect.html"):
            self.path = "/phone.html"
        elif u.path in ("/command", "/dashboard"):
            self.path = "/command.html"
        elif u.path == "/api/state":
            with LOCK:
                return self._json({"seq": S["seq"], "link": S["link"], "mode": S["mode"], "node": NODE,
                                   "msgs": [public(S["msgs"][i]) for i in S["order"]]})
        elif u.path == "/api/feed":
            since = int(q.get("since", ["0"])[0])
            with LOCK:
                return self._json({"seq": S["seq"], "link": S["link"], "mode": S["mode"],
                                   "events": [e for e in S["events"] if e["seq"] > since]})
        elif u.path == "/api/phone":
            mid = q.get("id", [""])[0]
            with LOCK:
                m = S["msgs"].get(mid)
                if not m: return self._json({"error": "unknown"}, 404)
                return self._json({"id": mid, "state": m["state"], "tries": m["tries"], "max": MAX_TRIES,
                                   "team": m["team"] if m["state"] == "DISPATCHED" else None, "replies": m["replies"],
                                   "report": m["report"], "token": m["token"]})
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path); j = self._body()
        if u.path == "/api/sos":
            m = new_sos(j); return self._json({"ok": True, "id": m["id"], "token": m["token"], "report": m["report"], "meter": m["meter"]})
        if u.path == "/api/button":
            m = new_sos({"cat": "TRAPPED", "people": 1, "button": True, "injured": "unsure", "note": "push button on beacon node"})
            return self._json({"ok": True, "id": m["id"]})
        if u.path == "/api/retry":
            with LOCK:
                m = S["msgs"].get(j.get("id"))
                if m and m["state"] == "FAILED": m.update(state="SENDING", tries=0, next_try=time.time())
            return self._json({"ok": True})
        if u.path in ("/api/read", "/api/dispatch", "/api/reply"):
            kind = {"/api/read": "READ", "/api/dispatch": "DISPATCH", "/api/reply": "REPLY"}[u.path]
            ids = [j.get("id")] if j.get("id") else [i for i in S["order"] if S["msgs"][i]["state"] in ("DELIVERED", "READ", "DISPATCHED")]
            ok = all(downlink(i, kind, str(j.get("text", ""))[:120]) for i in ids)
            return self._json({"ok": ok})
        if u.path == "/api/link":
            if S["mode"] == "LIVE":
                return self._json({"ok": False, "msg": "live node: unplug the USB cable instead"})
            S["link"] = bool(j.get("up", True))
            emit("link", up=S["link"], msg="Gateway reconnected" if S["link"] else "Gateway unplugged: LoRa link down")
            return self._json({"ok": True, "link": S["link"]})
        if u.path == "/api/clear":
            with LOCK:
                S["msgs"].clear(); S["order"].clear()
            emit("clear", msg="Inbox cleared for demo (history kept in voidnav.db events)")
            return self._json({"ok": True})
        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--node", action="store_true", help="use the real SOS Node1 ESP32 on USB (port found automatically)")
    ap.add_argument("--serial", help="SOS Node1 serial port, e.g. COM5 or /dev/ttyUSB0 (implies --node)")
    ap.add_argument("--port", type=int, default=PORT)
    a = ap.parse_args()
    live = bool(a.node or a.serial)
    try:
        srv = ThreadingHTTPServer(("0.0.0.0", a.port), H)
    except OSError:
        print(f"\n  Port {a.port} is busy. Close the other server window (or run: python server.py --port 8801)\n")
        input("Press Enter to exit"); sys.exit(1)
    print("=" * 66)
    if live:
        print("  VOID-NAV command · LIVE: SOS Node1 (ESP32) on USB")
        print(f"  Dashboard on this laptop : http://localhost:{a.port}/command")
        print("  Survivor phone           : join Wi-Fi \"SOS Node1\", open http://192.168.4.1")
        print("  (the laptop does NOT need to join SOS Node1; the ESP32 talks over the USB cable)")
    else:
        print("  VOID-NAV command · EMULATED link (no ESP32)")
        print(f"  Dashboard : http://localhost:{a.port}/command")
        print("  Survivor SOS page (phone on the same hotspot/Wi-Fi):")
        for x in all_ips():
            print(f"      http://{x}:{a.port}/")
    print("=" * 66)
    threading.Thread(target=radio_loop, daemon=True).start()
    if live:
        threading.Thread(target=serial_loop, args=(a.serial,), daemon=True).start()
    srv.serve_forever()

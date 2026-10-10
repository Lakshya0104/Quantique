"""VOID-NAV demo server.

Serves the dashboard and the phone SOS page, and relays phone SOS messages to
the dashboard (and READ / DISPATCHED status back to the phone).
Standard library only:  python server.py
"""
import json, socket, threading, time, uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8000
LOCK = threading.Lock()
MSGS = []      # SOS messages in arrival order
STATUS = {}    # id -> UNREAD | READ | DISPATCHED


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class H(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return {}

    def end_headers(self):
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path in ("/", "/sos", "/phone"):
            self.path = "/phone.html"
        if self.path.startswith("/api/poll"):
            since = int(self.path.split("since=")[-1]) if "since=" in self.path else 0
            with LOCK:
                return self._json({"next": len(MSGS), "msgs": MSGS[since:]})
        if self.path.startswith("/api/status"):
            mid = self.path.split("id=")[-1]
            with LOCK:
                return self._json({"id": mid, "state": STATUS.get(mid, "UNKNOWN")})
        return super().do_GET()

    def do_POST(self):
        j = self._body()
        if self.path == "/api/sos":
            m = {
                "type": "sos",
                "id": uuid.uuid4().hex[:8].upper(),
                "node": "N1",
                "text": str(j.get("text", ""))[:280],
                "people": max(1, min(99, int(j.get("people") or 1))),
                "injured": "YES" if j.get("injured") else "NO",
                "panic": bool(j.get("panic")),
                "lang": str(j.get("lang", "en"))[:5],
                "src": "phone",
                "t": time.time(),
            }
            with LOCK:
                MSGS.append(m)
                STATUS[m["id"]] = "UNREAD"
            print(f"  SOS {m['id']} from phone: {m['text']!r} ({m['people']} people)")
            return self._json({"ok": True, "id": m["id"]})
        if self.path == "/api/status":
            with LOCK:
                if j.get("id") in STATUS and STATUS[j["id"]] != "DISPATCHED":
                    STATUS[j["id"]] = j.get("state", "READ")
            print(f"  status {j.get('id')} -> {j.get('state')}")
            return self._json({"ok": True})
        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    ip = lan_ip()
    print("=" * 56)
    print(" VOID-NAV demo server")
    print(f"  Dashboard (laptop): http://localhost:{PORT}/index.html")
    print(f"  Phone SOS page    : http://{ip}:{PORT}/sos")
    print("  Phone and laptop must be on the same Wi-Fi / hotspot.")
    print("=" * 56)
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()

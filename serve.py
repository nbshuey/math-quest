"""Serve Math Quest locally, telling the browser to always check for newer files.

Plain `python3 -m http.server` lets the browser keep old copies of the app's
files after an update, which can leave a blank page until a hard refresh.

Run from this folder:  python3 serve.py        (or: python3 serve.py 8080)
Then open http://localhost:8000
"""

import http.server
import os
import socket
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def lan_address():
    """This Mac's address on the home network, for an iPad to open."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("192.168.0.1", 9))  # no packets are sent; this just picks the network card
            return s.getsockname()[0]
    except OSError:
        return None


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler) as server:
        print(f"Math Quest is running at http://localhost:{PORT}  (Ctrl+C to stop)", flush=True)
        ip = lan_address()
        if ip and not ip.startswith("127."):
            print(f"On an iPad on the same Wi-Fi, open http://{ip}:{PORT}", flush=True)
        server.serve_forever()

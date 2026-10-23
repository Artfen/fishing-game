"""Serve Slow Tide locally with caching turned off, so every refresh picks up your edits.

    python3 serve.py          # then open http://localhost:8642
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8642


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        # On Vercel, api/cloud-config.js answers this; locally cloud saves are simply off.
        if self.path.split("?")[0] == "/api/cloud-config":
            body = b'{"enabled": false}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), NoCache) as httpd:
    print(f"Slow Tide is at http://localhost:{PORT}")
    httpd.serve_forever()

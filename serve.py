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


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), NoCache) as httpd:
    print(f"Slow Tide is at http://localhost:{PORT}")
    httpd.serve_forever()

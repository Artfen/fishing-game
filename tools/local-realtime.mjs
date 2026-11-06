// A stand-in for Supabase Realtime on your own machine, for trying playing together locally with two
// browser windows (no Supabase project needed): the same Phoenix-channel protocol the game speaks
// (join, presence, broadcast, heartbeat), as tests/fakeRealtime.mjs, behind a real WebSocket.
//
//   node tools/local-realtime.mjs [port]      (default 8643)
//
// Then point the game at it: have api/cloud-config answer
// { "enabled": true, "url": "http://127.0.0.1:8643", "anonKey": "local" } (the browser checks do
// this with a Playwright route), or put that url and key in src/cloud-config.js on your machine
// (never commit it). Nothing here is for production: no auth, no limits, one hub for everyone.

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { Hub } from '../tests/fakeRealtime.mjs';

const port = Number(process.argv[2]) || 8643;
const hub = new Hub();

// One text frame, server to client (unmasked).
function frame(text) {
  const body = Buffer.from(text);
  const n = body.length;
  const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127]), Buffer.from([0, 0, 0, 0, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])]);
  return Buffer.concat([head, body]);
}

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
  res.end('local realtime stand-in\n');
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  // What the hub sees: something with a readyState that it delivers messages to.
  const ws = {
    readyState: 1,
    onmessage: ({ data }) => {
      if (!socket.destroyed) socket.write(frame(data));
    },
  };
  hub.sockets.add(ws);
  let buf = Buffer.alloc(0), parts = [];
  const close = () => {
    if (ws.readyState === 3) return;
    ws.readyState = 3;
    hub.gone(ws);
    socket.destroy();
  };
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2));
        off = 10;
      }
      const maskAt = off;
      if (masked) off += 4;
      if (buf.length < off + len) return;
      const data = Buffer.from(buf.subarray(off, off + len));
      if (masked) for (let i = 0; i < len; i++) data[i] ^= buf[maskAt + (i & 3)];
      buf = buf.subarray(off + len);
      if (op === 8) return close();
      if (op === 9) {
        socket.write(Buffer.concat([Buffer.from([0x8a, data.length]), data]));
        continue;
      }
      if (op === 1 || op === 0) {
        parts.push(data);
        if (!fin) continue;
        const text = Buffer.concat(parts).toString('utf8');
        parts = [];
        try {
          hub.handle(ws, JSON.parse(text));
        } catch { /* junk */ }
      }
    }
  });
  socket.on('close', close);
  socket.on('error', close);
});

server.listen(port, '127.0.0.1', () => console.log(`local realtime stand-in on ws://127.0.0.1:${port}`));

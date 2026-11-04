// A stand-in for Supabase Realtime for the tests: Phoenix channels over a fake WebSocket, with
// join, presence (track, state, diffs), broadcast (not echoed to the sender), heartbeats, and a
// way to drop a connection. Not a test file itself (see together.test.mjs and coop.test.mjs).

export class Hub {
  constructor() {
    this.rooms = new Map(); // topic -> Map(ws -> { key, meta })
    this.sockets = new Set();
    this.log = [];
    const hub = this;
    this.WS = class FakeWS {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        hub.sockets.add(this);
        setTimeout(() => {
          if (this.readyState !== 0) return;
          this.readyState = 1;
          this.onopen?.();
        }, 1);
      }
      send(text) {
        if (this.readyState !== 1) throw new Error('not open');
        const msg = JSON.parse(text);
        hub.log.push(msg);
        setTimeout(() => hub.handle(this, msg), 1);
      }
      close() {
        if (this.readyState === 3) return;
        this.readyState = 3;
        // (Like a real socket, what was sent before closing still arrives.)
        setTimeout(() => {
          hub.gone(this);
          this.onclose?.();
        }, 1);
      }
    };
  }

  deliver(ws, msg) {
    if (ws.readyState === 1) ws.onmessage?.({ data: JSON.stringify(msg) });
  }

  handle(ws, msg) {
    const { topic, event, payload, ref } = msg;
    const reply = (response = {}, status = 'ok') => this.deliver(ws, { topic, event: 'phx_reply', payload: { status, response }, ref });
    if (topic === 'phoenix' && event === 'heartbeat') return reply();
    let room = this.rooms.get(topic);
    if (event === 'phx_join') {
      if (!room) this.rooms.set(topic, (room = new Map()));
      room.set(ws, { key: payload.config.presence.key, meta: null });
      reply({ postgres_changes: [] });
      const state = {};
      for (const m of room.values()) if (m.meta) state[m.key] = { metas: [{ phx_ref: 'r', ...m.meta }] };
      this.deliver(ws, { topic, event: 'presence_state', payload: state, ref: null });
      return;
    }
    if (!room || !room.has(ws)) return;
    if (event === 'phx_leave') {
      reply();
      this.leaveRoom(ws, topic);
      return;
    }
    if (event === 'presence' && payload.type === 'presence' && payload.event === 'track') {
      const me = room.get(ws);
      const leaves = me.meta ? { [me.key]: { metas: [{ phx_ref: 'r', ...me.meta }] } } : {};
      me.meta = payload.payload;
      const diff = { joins: { [me.key]: { metas: [{ phx_ref: 'r2', ...me.meta }] } }, leaves };
      for (const other of room.keys()) this.deliver(other, { topic, event: 'presence_diff', payload: diff, ref: null });
      return;
    }
    if (event === 'broadcast') {
      for (const other of room.keys()) if (other !== ws) this.deliver(other, { topic, event: 'broadcast', payload, ref: null });
    }
  }

  leaveRoom(ws, topic) {
    const room = this.rooms.get(topic);
    const me = room?.get(ws);
    if (!me) return;
    room.delete(ws);
    if (me.meta) {
      const diff = { joins: {}, leaves: { [me.key]: { metas: [{ phx_ref: 'r', ...me.meta }] } } };
      for (const other of room.keys()) this.deliver(other, { topic, event: 'presence_diff', payload: diff, ref: null });
    }
  }

  gone(ws) {
    this.sockets.delete(ws);
    for (const topic of this.rooms.keys()) this.leaveRoom(ws, topic);
  }

  // The server (or the network) drops a connection.
  drop(ws) {
    ws.readyState = 3;
    this.gone(ws);
    setTimeout(() => ws.onclose?.(), 1);
  }
}


import net from 'net';
import msgpack from 'msgpack-lite';
import { MCPMessage, validateMessage } from '../schema/message.js';

export interface UnixSocketTransportOptions { path: string; maxQueue?: number; heartbeatIntervalMs?: number; handshakeTimeoutMs?: number; }

export class MCPUnixSocketServer {
  private server?: net.Server; private handlers: ((msg: MCPMessage, socket: net.Socket) => void)[] = [];
  private clients = new Set<net.Socket>();
  constructor(private options: UnixSocketTransportOptions) {}
  start() {
    if (this.server) return;
    this.server = net.createServer(socket => {
      this.clients.add(socket);
      let handshakeComplete = false;
      const decoder = msgpack.createDecodeStream();
      socket.pipe(decoder);
      const hbInterval = setInterval(() => {
        if (socket.destroyed) return; // send heartbeat to client
        socket.write(msgpack.encode({ type: 'PING', ts: Date.now() }));
      }, this.options.heartbeatIntervalMs || 10000).unref();
      const handshakeTimer = setTimeout(() => {
        if (!handshakeComplete) {
          socket.write(msgpack.encode({ error: 'handshake_timeout' }));
          socket.destroy();
        }
      }, this.options.handshakeTimeoutMs || 3000).unref();
      decoder.on('data', data => {
        try {
          // Raw object for control messages
          if (data && data.type === 'HELLO' && !handshakeComplete) {
            handshakeComplete = true;
            clearTimeout(handshakeTimer);
            socket.write(msgpack.encode({ type: 'ACK', ts: Date.now(), version: '1.0' }));
            return;
          }
          if (data && data.type === 'PONG') {
            return; // heartbeat response
          }
          const msg = validateMessage(data);
          this.handlers.forEach(h => h(msg, socket));
        } catch (e) {
          socket.write(msgpack.encode({ error: 'invalid_message', details: (e as Error).message }));
        }
      });
      socket.on('close', () => { clearInterval(hbInterval); this.clients.delete(socket); });
    });
    this.server.listen(this.options.path);
  }
  onMessage(handler: (msg: MCPMessage, socket: net.Socket) => void) { this.handlers.push(handler); }
  broadcast(msg: MCPMessage) { const encoded = msgpack.encode(msg); for (const c of this.clients) { c.write(encoded); } }
  stop() { this.server?.close(); this.server = undefined; this.clients.forEach(c => c.destroy()); this.clients.clear(); }
}

export class MCPUnixSocketClient {
  private socket?: net.Socket; private decoder = msgpack.createDecodeStream(); private listeners: ((msg: MCPMessage) => void)[] = [];
  private heartbeatTimer?: NodeJS.Timeout; private lastPing = 0; private acked = false;
  constructor(private options: UnixSocketTransportOptions) {}
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { handshakeTimeoutMs = 3000, heartbeatIntervalMs = 10000 } = this.options;
      let handshakeTimer: NodeJS.Timeout;
      this.socket = net.createConnection(this.options.path, () => {
        // Initiate handshake
        this.socket!.write(msgpack.encode({ type: 'HELLO', ts: Date.now(), client: 'mcp-client' }));
        handshakeTimer = setTimeout(() => {
          if (!this.acked) {
            reject(new Error('Handshake timeout'));
            this.socket?.destroy();
          }
        }, handshakeTimeoutMs).unref();
      });
      this.socket.once('error', err => reject(err));
      this.socket.pipe(this.decoder);
      this.decoder.on('data', data => {
        if (data && data.type === 'ACK') {
          this.acked = true; clearTimeout(handshakeTimer); // start heartbeat responder
          this.heartbeatTimer = setInterval(() => {
            if (!this.socket || this.socket.destroyed) return;
            this.socket.write(msgpack.encode({ type: 'PONG', ts: Date.now() }));
          }, heartbeatIntervalMs).unref();
          resolve();
          return;
        }
        if (data && data.type === 'PING') {
          // respond immediately
          this.lastPing = Date.now();
          this.socket?.write(msgpack.encode({ type: 'PONG', ts: Date.now() }));
          return;
        }
        try { const msg = validateMessage(data); this.listeners.forEach(l => l(msg)); } catch { /* ignore */ }
      });
    });
  }
  send(msg: MCPMessage) { if (!this.socket) throw new Error('Socket not connected'); this.socket.write(msgpack.encode(msg)); }
  onMessage(listener: (msg: MCPMessage) => void) { this.listeners.push(listener); }
  close() { if (this.heartbeatTimer) clearInterval(this.heartbeatTimer); this.socket?.end(); this.socket = undefined; }
}

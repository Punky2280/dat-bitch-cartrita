import net from 'net';
import msgpack from 'msgpack-lite';
import { validateMessage } from '../schema/message.js';
export class MCPUnixSocketServer {
    options;
    server;
    handlers = [];
    constructor(options) {
        this.options = options;
    }
    start() { if (this.server)
        return; this.server = net.createServer(socket => { const decoder = msgpack.createDecodeStream(); socket.pipe(decoder); decoder.on('data', data => { try {
        const msg = validateMessage(data);
        this.handlers.forEach(h => h(msg, socket));
    }
    catch (e) {
        socket.write(msgpack.encode({ error: 'invalid_message', details: e.message }));
    } }); }); this.server.listen(this.options.path); }
    onMessage(handler) { this.handlers.push(handler); }
    stop() { this.server?.close(); this.server = undefined; }
}
export class MCPUnixSocketClient {
    options;
    socket;
    decoder = msgpack.createDecodeStream();
    listeners = [];
    constructor(options) {
        this.options = options;
    }
    connect() { return new Promise((resolve, reject) => { this.socket = net.createConnection(this.options.path, () => resolve()); this.socket.once('error', err => reject(err)); this.socket.pipe(this.decoder); this.decoder.on('data', data => { try {
        const msg = validateMessage(data);
        this.listeners.forEach(l => l(msg));
    }
    catch { /* ignore */ } }); }); }
    send(msg) { if (!this.socket)
        throw new Error('Socket not connected'); this.socket.write(msgpack.encode(msg)); }
    onMessage(listener) { this.listeners.push(listener); }
    close() { this.socket?.end(); this.socket = undefined; }
}

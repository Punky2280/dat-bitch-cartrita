import net from 'net';
import { MCPMessage } from '../schema/message.js';
export interface UnixSocketTransportOptions {
    path: string;
    maxQueue?: number;
    heartbeatIntervalMs?: number;
    handshakeTimeoutMs?: number;
}
export declare class MCPUnixSocketServer {
    private options;
    private server?;
    private handlers;
    private clients;
    constructor(options: UnixSocketTransportOptions);
    start(): void;
    onMessage(handler: (msg: MCPMessage, socket: net.Socket) => void): void;
    broadcast(msg: MCPMessage): void;
    stop(): void;
}
export declare class MCPUnixSocketClient {
    private options;
    private socket?;
    private decoder;
    private listeners;
    private heartbeatTimer?;
    private lastPing;
    private acked;
    constructor(options: UnixSocketTransportOptions);
    connect(): Promise<void>;
    send(msg: MCPMessage): void;
    onMessage(listener: (msg: MCPMessage) => void): void;
    close(): void;
}
//# sourceMappingURL=unix-socket.d.ts.map
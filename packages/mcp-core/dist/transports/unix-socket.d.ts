import net from 'net';
import { MCPMessage } from '../schema/message.js';
export interface UnixSocketTransportOptions {
    path: string;
    maxQueue?: number;
}
export declare class MCPUnixSocketServer {
    private options;
    private server?;
    private handlers;
    constructor(options: UnixSocketTransportOptions);
    start(): void;
    onMessage(handler: (msg: MCPMessage, socket: net.Socket) => void): void;
    stop(): void;
}
export declare class MCPUnixSocketClient {
    private options;
    private socket?;
    private decoder;
    private listeners;
    constructor(options: UnixSocketTransportOptions);
    connect(): Promise<void>;
    send(msg: MCPMessage): void;
    onMessage(listener: (msg: MCPMessage) => void): void;
    close(): void;
}
//# sourceMappingURL=unix-socket.d.ts.map
import { EventEmitter } from 'events';
import { MCPMessage } from '../schema/message.js';
type Handler = (msg: MCPMessage) => Promise<void> | void;
export declare class MCPInProcessTransport {
    private options;
    private bus;
    private subs;
    constructor(options?: {
        maxListeners?: number;
    });
    publish(raw: unknown): void;
    subscribe(recipient: string, handler: Handler): () => EventEmitter<[never]>;
    dispose(): void;
}
export declare const inProcessTransport: MCPInProcessTransport;
export {};
//# sourceMappingURL=inprocess.d.ts.map
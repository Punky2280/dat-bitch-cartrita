import { EventEmitter } from 'events';
import { context, trace } from '@opentelemetry/api';
import { MCPMessage, validateMessage } from '../schema/message.js';

type Handler = (msg: MCPMessage) => Promise<void> | void;
interface Subscription { recipient: string; handler: Handler; }

export class MCPInProcessTransport {
  private bus = new EventEmitter();
  private subs: Subscription[] = [];
  constructor(private options: { maxListeners?: number } = {}) {
    if (options.maxListeners) this.bus.setMaxListeners(options.maxListeners);
  }
  publish(raw: unknown) {
    const msg = validateMessage(raw);
    const span = trace.getTracer('mcp-core').startSpan('mcp.transport.inprocess.publish', { attributes: { 'mcp.message.id': msg.id, 'mcp.message.type': msg.message_type, 'mcp.message.sender': msg.sender, 'mcp.message.recipient': msg.recipient } });
    try { this.bus.emit(msg.recipient, msg); } finally { span.end(); }
  }
  subscribe(recipient: string, handler: Handler) {
    const wrapped = (msg: MCPMessage) => {
      const activeCtx = context.active();
      trace.getTracer('mcp-core').startActiveSpan('mcp.transport.inprocess.consume', { attributes: { 'mcp.message.id': msg.id, 'mcp.message.type': msg.message_type, 'mcp.message.sender': msg.sender, 'mcp.message.recipient': msg.recipient } }, activeCtx, span => {
        Promise.resolve(handler(msg)).catch(err => { span.recordException(err); span.setStatus({ code: 2, message: err.message }); }).finally(() => span.end());
      });
    };
    this.bus.on(recipient, wrapped); this.subs.push({ recipient, handler }); return () => this.bus.off(recipient, wrapped);
  }
  dispose() { this.subs.forEach(s => this.bus.removeAllListeners(s.recipient)); this.bus.removeAllListeners(); }
}
export const inProcessTransport = new MCPInProcessTransport();

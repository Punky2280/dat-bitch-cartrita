import { MCPInProcessTransport } from './inprocess.js';

// Ensure true singleton even if package loaded via differing paths by stashing on globalThis.
const g: any = globalThis as any;
if (!g.__CARTRITA_SHARED_TRANSPORT__) {
	g.__CARTRITA_SHARED_TRANSPORT__ = new MCPInProcessTransport();
}
export const sharedInProcessTransport: MCPInProcessTransport = g.__CARTRITA_SHARED_TRANSPORT__;

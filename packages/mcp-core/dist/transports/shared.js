import { MCPInProcessTransport } from './inprocess.js';
// Ensure true singleton even if package loaded via differing paths by stashing on globalThis.
const g = globalThis;
if (!g.__CARTRITA_SHARED_TRANSPORT__) {
    g.__CARTRITA_SHARED_TRANSPORT__ = new MCPInProcessTransport();
}
export const sharedInProcessTransport = g.__CARTRITA_SHARED_TRANSPORT__;

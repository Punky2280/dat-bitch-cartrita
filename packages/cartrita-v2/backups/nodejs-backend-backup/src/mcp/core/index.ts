/**
 * @fileoverview MCP Core Library Index
 * Main entry point for the Cartrita Master Control Program core library
 */

// Schema and types
export * from './schema/mcp-types.js';
export { MCPValidator } from './schema/mcp-types.js';

// Transport layers
export {
  MCPInProcessTransport,
  createInProcessTransport,
} from './transport/in-process.js';
export {
  MCPUnixSocketTransport,
  createUnixSocketTransport,
} from './transport/unix-socket.js';

// Utilities
export { Logger, defaultLogger, log } from './utils/logger.js';

// OpenTelemetry integration
export {
  MCPMetrics,
  getMetrics,
  createPerformanceTimer,
} from './otel/metrics.js';

// Re-export generated protobuf types when available
export * from './generated/index.js';

// Version and metadata
export const MCP_VERSION = '1.0.0';
export const MCP_PROTOCOL_VERSION = '1.0';

export default {
  MCP_VERSION,
  MCP_PROTOCOL_VERSION,
};

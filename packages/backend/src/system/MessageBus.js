// packages/backend/src/system/MessageBus.js
const EventEmitter = require('events');

/**
 * The MessageBus is a singleton event emitter that serves as the central
 * communication channel for all AGI components. It allows for a decoupled
 * architecture where agents can communicate without direct dependencies.
 * This is the foundation of the Multi-Agent Communication Protocol (MCP).
 *
 * It allows agents to:
 * - Emit events (e.g., 'task:start', 'task:complete', 'data:retrieved')
 * - Listen for events from other agents
 */
class MessageBus extends EventEmitter {}

// Create a single, shared instance of the bus to be used across the application.
const instance = new MessageBus();

module.exports = instance;

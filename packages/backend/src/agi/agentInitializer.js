// packages/backend/src/agi/agentInitializer.js

/**
 * This module activates all specialized sub-agents by requiring their files.
 * Each agent is a singleton that, upon instantiation, subscribes to the
 * MessageBus for relevant tasks. This creates a decoupled, event-driven
 * architecture for the AGI's consciousness.
 */
function initializeAgents() {
  console.log('[Agent Initializer] Activating all sub-agents...');
  require('./consciousness/CodeWriterAgent');
  require('./consciousness/ArtistAgent');
  require('./consciousness/WriterAgent');
  require('./consciousness/SchedulerAgent');
  require('./consciousness/GitHubSearchAgent');
  console.log('[Agent Initializer] All agents are now listening on the MessageBus.');
}

module.exports = initializeAgents;
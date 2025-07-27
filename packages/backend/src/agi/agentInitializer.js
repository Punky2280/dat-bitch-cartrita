// packages/backend/src/agi/agentInitializer.js

/**
 * This module's purpose is to import and thereby instantiate all AGI sub-agents.
 * When an agent's module is imported, its constructor is called, and it begins
 * listening for tasks on the MessageBus. This keeps the main server file clean
 * and provides a central place to manage which agents are active.
 */
function initializeAgents() {
  console.log('[Agent Initializer] Activating all sub-agents...');
  
  // Import each agent to activate its listener
  require('./consciousness/CodeWriterAgent');
  // require('./consciousness/ResearcherAgent'); // <-- Add other agents here as they are refactored
  // require('./consciousness/ComedianAgent');
  // require('./ethics/ConstitutionalAI');
  
  console.log('[Agent Initializer] All agents are now listening on the MessageBus.');
}

module.exports = initializeAgents;

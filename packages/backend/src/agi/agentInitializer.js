// packages/backend/src/agi/agentInitializer.js

function initializeAgents() {
  console.log('[Agent Initializer] Activating all sub-agents...');
  
  // Import each agent to activate its listener
  require('./consciousness/CodeWriterAgent');
  require('./consciousness/SchedulerAgent');
  require('./consciousness/ArtistAgent'); // ACTIVATE THE NEW AGENT
  // require('./consciousness/ResearcherAgent'); 
  // require('./consciousness/ComedianAgent');
  // require('./ethics/ConstitutionalAI');
  
  console.log('[Agent Initializer] All agents are now listening on the MessageBus.');
}

module.exports = initializeAgents;

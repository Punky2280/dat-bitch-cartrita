const ResearcherAgent = require('./ResearcherAgent.js');
const ComedianAgent = require('./ComedianAgent.js');
const ConstitutionalAI = require('../ethics/ConstitutionalAI.js'); // Import the new agent

class SubAgentSpawner {
  constructor() {
    this.registry = {};
    console.log("Sub-Agent Spawner initialized with dynamic registry.");
  }
  register(agentType, agentClass) {
    this.registry[agentType] = agentClass;
    console.log(`Agent type '${agentType}' registered.`);
  }
  spawn(agentType) {
    const AgentClass = this.registry[agentType];
    if (AgentClass) {
      console.log(`Spawning a '${agentType}' sub-agent...`);
      return new AgentClass();
    }
    console.error(`Attempted to spawn unknown agent type: '${agentType}'.`);
    return null;
  }
}

const spawnerInstance = new SubAgentSpawner();
spawnerInstance.register('researcher', ResearcherAgent);
spawnerInstance.register('comedian', ComedianAgent);
spawnerInstance.register('ethical_dilemma', ConstitutionalAI); // Register the new agent
module.exports = spawnerInstance;

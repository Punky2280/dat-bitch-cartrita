// packages/backend/src/agi/consciousness/ToolAgent.js
const BaseAgent = require('../../system/BaseAgent');
const MessageBus = require('../../system/EnhancedMessageBus');

// Define the tools in a constant for easier access by static methods
const TOOLS = {
  getCurrentDateTime: {
    description: "Gets the current date and time in a human-readable format. Use this for any questions about 'today', 'now', or the current time.",
    execute: async (params) => new Date().toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  },
  getSystemStatus: {
    description: "Checks the operational status of the agent system and returns key metrics like active agent count.",
    execute: async (params) => {
      return {
        status: 'All systems operational.',
        // NOTE: MessageBus.getAgents() returns an array of agent objects.
        activeAgents: MessageBus.getAgents().filter(a => a.state === 'idle').length,
        memoryUsage: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      };
    },
  },
};


class ToolAgent extends BaseAgent {
  constructor() {
    super('ToolAgent', 'main', ['tool_use']);
    this.tools = TOOLS;
  }

  async onInitialize() {
    this.logger.info('Internal tools are ready.');
    this.registerTaskHandler({
      taskType: 'tool_use',
      handler: this.executeTool.bind(this)
    });
  }

  async executeTool(details) {
    // FIX: Correctly parse the 'name' and 'params' from the details object.
    const toolName = details?.name;
    const params = details?.params || {};

    if (toolName && this.tools[toolName]) {
      this.logger.info(`Executing tool: ${toolName}`, { params });
      // Pass the params object to the tool's execute function
      const result = await this.tools[toolName].execute(params);
      return result;
    }
    // Provide a more helpful error message if the tool is not found.
    throw new Error(`Tool '${toolName || JSON.stringify(details)}' not found.`);
  }

  getToolManifest() {
    const manifest = {};
    for (const toolName in this.tools) {
      manifest[toolName] = this.tools[toolName].description;
    }
    return manifest;
  }

  // FIX: Make this static method self-sufficient to avoid circular dependencies.
  static getToolManifest() {
    const manifest = {};
    for (const toolName in TOOLS) {
      manifest[toolName] = TOOLS[toolName].description;
    }
    return manifest;
  }
}

module.exports = new ToolAgent();
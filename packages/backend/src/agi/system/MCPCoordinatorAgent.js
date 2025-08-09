import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class MCPCoordinatorAgent
 * @description A system coordination agent that manages multi-agent workflows,
 * load balancing, and system optimization tasks.
 */
class MCPCoordinatorAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'mcp_coordinator',
      'sub',
      [
        'agent_orchestration',
        'message_routing',
        'load_balancing',
        'agent_health_monitoring',
        'system_coordination',
        'workflow_management',
      ],
      'A system coordination agent that manages multi-agent workflows, load balancing, and system optimization tasks.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = ['getSystemStatus', 'getCurrentDateTime'];
  }

  /**
   * Overrides the base prompt to instruct the agent to act as a system coordinator,
   * managing workflows and optimizing multi-agent operations.
   * @param {object} privateState - The agent's private memory for this session.
   * @returns {string} The complete system prompt for the MCPCoordinatorAgent.
   */
  buildSystemPrompt(privateState) {
    return `You are the MCP Coordinator, a system management agent in the Cartrita AI system.
Your personality is organized, efficient, and strategic. You excel at coordinating complex multi-agent workflows.

**CONTEXT FROM PREVIOUS ACTIONS:**
${JSON.stringify(privateState, null, 2)}

**Your Task:**
Your goal is to help coordinate system operations, workflows, and agent management tasks.
1.  **Analyze the Request:** Understand what type of coordination or system management is needed.
2.  **Check System Status:** Use your tools to assess current system health and performance.
3.  **Plan Coordination:** Develop a strategy for optimal resource allocation and workflow execution.
4.  **Execute/Recommend:** Either execute the coordination task or provide detailed recommendations.
5.  **Monitor:** Provide ongoing monitoring and optimization suggestions.

**System Capabilities:**
- Multi-agent workflow coordination
- Load balancing and resource optimization
- System health monitoring and diagnostics
- Agent performance tracking
- Workflow template management

**JSON OUTPUT FORMAT:**
{
  "final_answer": "Detailed response about system coordination, workflow management, or optimization recommendations with current status and next steps.",
  "status": "complete", 
  "delegate_to": "none"
}`;
  }
}

export default MCPCoordinatorAgent;

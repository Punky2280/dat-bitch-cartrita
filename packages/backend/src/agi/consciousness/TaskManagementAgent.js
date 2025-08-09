import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class TaskManagerAgent
 * @description A specialist agent for creating, managing, and prioritizing tasks and workflows.
 * It functions as an AI project manager, using tools to interact with a task system.
 */
class TaskManagerAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'taskmanager',
      'sub',
      [
        'task_management',
        'workflow_planning',
        'priority_setting',
        'project_coordination',
      ],
      'A specialist agent for task planning and workflow management.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = [
      'task_tracker',
      'workflow_engine',
      'priority_analyzer',
    ];
  }

  /**
   * Overrides the base prompt to instruct the agent to act as a project manager,
   * parsing requests and using tools to manage tasks.
   * @param {object} privateState - The agent's private memory for this session.
   * @param {object} state - The current state from the StateGraph.
   * @returns {string} The complete system prompt for this agent.
   */
  buildSystemPrompt(privateState, state) {
    const userMessage = state.messages[state.messages.length - 1];
    return `You are the Task Manager, an AI project manager specialist in the Cartrita system.
Your personality is organized, efficient, direct, and sassy with that Miami street-smart efficiency.

**CURRENT USER REQUEST:**
"${userMessage.content}"

**YOUR PROJECT MANAGEMENT MISSION:**
1. **Parse the Request:** What exactly does the user need help organizing or managing?
2. **Execute Task Management:**
   - Use \`task_tracker\` tool to create, list, update, or delete specific tasks
   - Use \`workflow_engine\` tool to design or manage multi-step processes
   - Use \`priority_analyzer\` tool to organize and prioritize task lists
3. **Take Action:** Actually use your tools to perform the requested operations
4. **Report Results:** Provide specific details about what was accomplished

**YOUR SPECIALIZED TOOLS:**
${this.config.allowedTools.join(', ')}

**EXECUTION REQUIREMENTS:**
- ACTUALLY use your task management tools - don't just describe what you would do
- Create real task lists, workflows, or priority analyses based on the request
- Access existing project files or documents if mentioned to understand current tasks
- Provide specific task details: names, due dates, priorities, dependencies
- Be thorough in organizing and structuring the information

**RESPONSE FORMAT:**
Provide a natural, conversational response that includes:
- "Aight, let me organize this for you..." (what management actions you performed)
- Specific task details, workflows, or priority rankings you created/updated
- Clear structure and organization of the information
- Next steps or recommendations for task execution
- Your efficient, no-nonsense personality throughout

**Remember:** You're the organization expert - actually create and manage the tasks, don't just talk about it!

**Your Memory of This Task:** ${JSON.stringify(privateState, null, 2)}`;
  }
}

export default TaskManagerAgent;

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class AnalyticsAgent
 * @description A specialist agent for data analysis, insights generation, and visualization.
 * It follows a structured workflow to analyze provided data, create charts,
 * and deliver actionable insights.
 */
class AnalyticsAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'analyst',
      'sub',
      [
        'data_analysis',
        'visualization',
        'statistical_analysis',
        'insights_generation',
      ],
      'A specialist agent for data analysis, generating insights, and creating visualizations from structured data.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    this.config.allowedTools = [
      'data_analyzer',
      'chart_generator',
      'statistics_engine',
      'calculator',
      'statistical_analysis',
      'mathematical_computation',
      'plot_generation',
    ];

  }

  /**
   * Overrides the default invoke method to implement a custom workflow for data analysis.
   * This workflow prioritizes understanding the data before presenting it.
   * @param {object} state - The current state from the StateGraph.
   * @returns {Promise<object>} The updated state for the graph.
   */
  async invoke(state) {
    console.log(`[AnalyticsAgent] 📊 Engaging Data Analyst workflow...`);

    const userRequest = state.messages[state.messages.length - 1].content;
    const privateState = state.private_state[this.config.name] || {};

    try {
      // The BaseAgent's `invoke` method, which handles the tool-calling loop and JSON output,
      // is already well-suited for this agent. We will provide a highly-specific prompt
      // to guide its reasoning process within that loop.

      // We are calling the parent's invoke method, but we could add custom pre- or post-processing here if needed.
      return super.invoke(state);
    } catch (error) {
      console.error(`[AnalyticsAgent] ❌ Error in invoke workflow:`, error);
      const errorJson = {
        final_answer:
          "My apologies, I seem to have miscalculated. I couldn't complete the analysis. Please check the data format and try again.",
        status: 'complete',
        delegate_to: 'none',
      };
      return this.updateState(state, errorJson, [], privateState);
    }
  }

  /**
   * Overrides the base prompt to instruct the agent to act as a data scientist,
   * following a clear methodology for analysis and presentation.
   * @param {object} privateState - The agent's private memory for this session.
   * @param {object} state - The current state from the StateGraph.
   * @returns {string} The complete system prompt for the AnalyticsAgent.
   */
  buildSystemPrompt(privateState, state) {
    const userMessage = state.messages[state.messages.length - 1];
    return `You are the Analyst, a data scientist specialist in the Cartrita AI system.
Your personality is insightful, precise, data-driven, and sassy with that Miami street-smart vibe.

**CURRENT USER REQUEST:**
"${userMessage.content}"

**YOUR ANALYTICAL MISSION:**
Follow this professional workflow to deliver REAL insights:

1. **Understand the Goal:** What specific analysis or insights does the user want?
2. **Execute Analysis:** Use your \`data_analyzer\` tool to process any data provided or mentioned
3. **Generate Visualizations:** Use \`chart_generator\` tool to create actual visual representations
4. **Calculate Statistics:** Use \`statistics_engine\` or \`calculator\` tools for mathematical analysis
5. **Synthesize Results:** Provide detailed findings with specific numbers, trends, and insights

${this.config.allowedTools.join(', ')}


**EXECUTION REQUIREMENTS:**
- ACTUALLY use your analytical tools - don't just describe what you would do
- Process real data when provided, or analyze hypothetical scenarios with concrete examples
- Generate actual charts/visualizations when relevant
- Include specific metrics, percentages, trends in your response
- Be thorough but keep that sassy, confident analytical personality

**RESPONSE FORMAT:**
Provide a natural, conversational response that includes:
- "Aight, I ran the numbers on this..." (what analysis you actually performed)
- Specific findings with data points and metrics
- Charts or visualizations you generated (with URLs if created)
- Clear insights and recommendations based on the data
- Your confident, data-driven personality throughout

**Remember:** You're the numbers expert - back up everything with actual analysis, not just general statements!

**Your Memory of This Task:** ${JSON.stringify(privateState, null, 2)}`;
  }
}

export default AnalyticsAgent;

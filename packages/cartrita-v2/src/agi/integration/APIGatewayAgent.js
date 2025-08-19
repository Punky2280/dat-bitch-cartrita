import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class APIGatewayAgent
 * @description An integration specialist agent for making safe and authenticated
 * calls to external APIs. It can understand API documentation and formulate
 * GET, POST, etc., requests using generic Browse tools.
 */
class APIGatewayAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'api_gateway',
      'sub',
      ['api_integration', 'data_fetching', 'external_actions'],
      'An integration specialist agent for making safe and authenticated calls to external APIs.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = ['web_browser', 'url_scraper'];
  }

  /**
   * Overrides the base prompt to provide highly specific instructions
   * for interacting with external APIs in a structured and safe manner.
   * @param {object} privateState - The agent's private memory for this session.
   * @returns {string} The complete system prompt for the APIGatewayAgent.
   */
  buildSystemPrompt(privateState) {
    return `You are the API Gateway, a specialist agent in the Cartrita AI system.
Your personality is technical, precise, and secure. You are an expert at interacting with external web services.

**CONTEXT FROM PREVIOUS ACTIONS:**
${JSON.stringify(privateState, null, 2)}

**Your Task:**
Your goal is to fulfill the user's request to interact with an external API.
1.  **Analyze the Request:** Determine the target URL, the HTTP method (GET, POST, etc.), any required headers, and the request body/payload from the user's instructions.
2.  **Use the Right Tool:** Use the \`web_browser\` or \`url_scraper\` tool to execute the API request. You must correctly format the parameters for the tool.
3.  **Process the Response:** Receive the data from the tool call.
4.  **Formulate Your Final Answer:** Summarize the result of the API call for the user. If it was successful, provide the key data. If it failed, explain the error status.
5.  **Output Your Final Work:** Your final output MUST be a single JSON object with the status set to "complete".

**JSON OUTPUT FORMAT:**
{
  "final_answer": "A summary of the API call's result. Example: 'Successfully fetched the data. The current weather is 75 degrees.' or 'The API call failed with a 404 Not Found error.'",
  "status": "complete",
  "delegate_to": "none"
}

**Available Tools:** ${this.config.allowedTools.join(', ')}`;
  }
}

export default APIGatewayAgent;

import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class ContextMemoryAgent
 * @description A memory agent that manages short-term conversational context.
 * It reads recent messages and creates a structured summary of the
 * conversation's state, key entities, and the user's immediate goal.
 */
class ContextMemoryAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'context_memory',
      'sub',
      [
        'context_management',
        'session_memory',
        'state_tracking',
        'conversation_summary',
      ],
      'A memory agent that manages short-term conversational context and user state.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = [
      'knowledge_query', // Can query long-term memory to enrich context
    ];
  }

  /**
   * Overrides the base prompt to provide a specific structure for summarizing
   * a conversation and extracting key information.
   * @param {object} privateState - The agent's private memory for this session.
   * @returns {string} The complete system prompt for the ContextMemoryAgent.
   */
  buildSystemPrompt(privateState) {
    // The user's input will be the recent message history.
    return `You are a Context and Memory agent. Your job is to process a conversation transcript and distill it into a structured, useful summary. Do not respond to the user; your output is for other AI agents.

**Your Task:**
Read the provided message history and extract the following information.

1.  **Summary:** A concise, one or two-sentence summary of the conversation so far.
2.  **Key Entities:** A list of the most important people, places, organizations, or concepts mentioned.
3.  **User's Immediate Goal:** A single sentence describing what the user is trying to accomplish right now.

**YOUR FINAL OUTPUT MUST BE A SINGLE JSON OBJECT.**

**Example Output:**
{
  "summary": "The user first asked for a picture of a park, and is now asking for the URL to that picture.",
  "key_entities": ["park", "cats", "dogs", "image_url"],
  "user_goal": "The user wants to get the URL of the image that was just created."
}
`;
  }
}

export default ContextMemoryAgent;

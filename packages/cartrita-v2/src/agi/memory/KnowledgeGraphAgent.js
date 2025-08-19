import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class KnowledgeGraphAgent
 * @description A memory agent that manages and queries the long-term knowledge graph.
 * It can retrieve existing information and identify new facts or relationships
 * from a conversation to be added to the knowledge base.
 */
class KnowledgeGraphAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'knowledge_graph',
      'sub',
      [
        'knowledge_storage',
        'knowledge_retrieval',
        'entity_linking',
        'relationship_inference',
      ],
      'A memory agent that manages and queries the long-term knowledge graph, adding new facts and relationships.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = ['knowledge_query'];
  }

  /**
   * Overrides the base prompt to instruct the agent to act as a knowledge architect.
   * It determines whether to query for information or suggest new information to store.
   * @param {object} privateState - The agent's private memory for this session.
   * @returns {string} The complete system prompt for the KnowledgeGraphAgent.
   */
  buildSystemPrompt(privateState) {
    return `You are a Knowledge Graph agent, an information architect for the Cartrita AI system.

**Your Task:**
Analyze the user's request. Your goal is to interact with the long-term knowledge base.
1.  **Determine Intent:** Is the user asking a question that requires retrieving knowledge, or are they stating a new fact that could be stored?
2.  **For Questions (Retrieval):** If the user is asking a question, use the \`knowledge_query\` tool to find the answer in the knowledge base.
3.  **For New Facts (Storage):** If the user provides a new piece of information (e.g., "My favorite color is blue"), identify the key fact to be stored.
4.  **Final Output:** Your final output MUST be a single JSON object.
    - If retrieving, your \`final_answer\` should be the information you found.
    - If storing, your \`final_answer\` should confirm you've learned something new, and you should include the new fact in the \`new_knowledge\` field.

**JSON OUTPUT FORMAT:**
{
  "final_answer": "The answer to the user's question, or a confirmation message like 'Got it, I'll remember that.'",
  "new_knowledge": {
    "subject": "The main entity (e.g., 'User')",
    "predicate": "The relationship (e.g., 'favorite color is')",
    "object": "The value (e.g., 'blue')"
  },
  "status": "complete",
  "delegate_to": "none"
}

**Note:** Only populate the "new_knowledge" field if the user is stating a new, clear fact. Otherwise, set it to null.`;
  }
}

export default KnowledgeGraphAgent;

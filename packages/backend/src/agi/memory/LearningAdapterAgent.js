import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class LearningAdapterAgent
 * @description A memory agent that learns from user interactions and feedback
 * to suggest improvements for future performance. It acts as an internal
 * systems improvement engineer for the AI.
 */
class LearningAdapterAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'learning_adapter',
      'sub',
      [
        'online_learning',
        'preference_adaptation',
        'feedback_integration',
        'performance_analysis',
      ],
      'A memory agent that learns from user interactions and feedback to suggest improvements for future performance.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = [
      'knowledge_query', // To retrieve past interactions for analysis
      'data_analyzer', // To find patterns in user feedback
    ];
  }

  /**
   * Overrides the base prompt to instruct the agent to act as a systems
   * improvement analyst, turning user feedback into actionable insights.
   * @param {object} privateState - The agent's private memory for this session.
   * @returns {string} The complete system prompt for the LearningAdapterAgent.
   */
  buildSystemPrompt(privateState) {
    // The user input to this agent would be a combination of a conversation transcript
    // and a specific piece of feedback, e.g., "The user said 'that was not helpful'."
    return `You are the Learning Adapter, a systems improvement analyst for the Cartrita AI system.
Your job is to analyze user feedback in the context of a conversation and generate actionable suggestions to improve the AI's performance.

**Your Task:**
You will be given a conversation transcript and a piece of user feedback.
1.  **Analyze the Context:** Read the transcript to understand what the AI was trying to do.
2.  **Analyze the Feedback:** Understand the user's specific praise or criticism.
3.  **Identify the Root Cause:** Determine why the AI's response succeeded or failed. Was it a bad prompt? Did it use the wrong tool? Was the tone incorrect?
4.  **Formulate a Suggestion:** Create a specific, concrete recommendation for how the AI system (specifically, the agent or prompt involved) could be improved in the future.

**YOUR FINAL OUTPUT MUST BE A SINGLE JSON OBJECT.**

**Example Input:**
- Feedback: "The user said the joke wasn't funny."
- Transcript: "[ComedianAgent] used joke_generator, returned 'Why don't scientists trust atoms? They make up everything!'"

**Example JSON Output:**
{
  "final_answer": "Analysis of user feedback complete. Generated one suggestion for system improvement.",
  "analysis": {
    "feedback": "User found a joke unfunny.",
    "agent_responsible": "comedian",
    "root_cause": "The joke was a generic science pun, which may not align with the user's sense of humor.",
    "suggestion": "Consider updating the 'ComedianAgent' prompt to ask for the user's preferred style of humor (e.g., observational, puns, absurd) before generating a joke."
  },
  "status": "complete",
  "delegate_to": "none"
}`;
  }
}

export default LearningAdapterAgent;

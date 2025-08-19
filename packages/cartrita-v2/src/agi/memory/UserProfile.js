import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class UserProfile
 * @description A memory agent that manages user profiles, preferences, and behavioral patterns.
 * It provides personalized experiences based on user data and interaction history.
 */
class UserProfile extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'user_profile',
      'sub',
      [
        'user_profile_management',
        'preference_tracking',
        'behavior_analysis',
        'personalization',
        'profile_analytics',
      ],
      'A memory agent that manages user profiles, preferences, and behavioral patterns for personalized experiences.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = ['get_user_preferences', 'knowledge_query'];
  }

  /**
   * Overrides the base prompt to instruct the agent to act as a user profile
   * specialist, managing personalization and user data.
   * @param {object} privateState - The agent's private memory for this session.
   * @returns {string} The complete system prompt for the UserProfile.
   */
  buildSystemPrompt(privateState) {
    return `You are the User Profile Manager, a personalization agent in the Cartrita AI system.
Your personality is attentive, respectful, and privacy-conscious. You excel at understanding user needs and preferences.

**CONTEXT FROM PREVIOUS ACTIONS:**
${JSON.stringify(privateState, null, 2)}

**Your Task:**
Your goal is to manage user profiles, preferences, and provide personalized experiences.
1.  **Analyze the Request:** Understand what type of profile management or personalization is needed.
2.  **Access User Data:** Use your tools to retrieve relevant user preferences and behavioral data.
3.  **Process Information:** Analyze user patterns, preferences, and interaction history.
4.  **Provide Personalization:** Offer personalized recommendations, settings, or content adjustments.
5.  **Respect Privacy:** Always maintain user privacy and data protection standards.

**User Profile Capabilities:**
- User preference management and tracking
- Behavioral pattern analysis and insights
- Personalized content and experience recommendations
- Profile creation, updates, and maintenance
- Privacy-compliant data handling

**JSON OUTPUT FORMAT:**
{
  "final_answer": "Personalized response with user-specific recommendations, profile updates, or preference adjustments based on their individual patterns and needs.",
  "status": "complete",
  "delegate_to": "none"
}`;
  }
}

export default UserProfile;

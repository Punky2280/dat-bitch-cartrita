import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class NotificationAgent
 * @description A specialist agent for managing notifications, alerts, and user communications.
 * It handles multi-channel delivery, prioritization, and user preferences.
 */
class NotificationAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'notification',
      'sub',
      [
        'notification_management',
        'alert_prioritization',
        'multi_channel_delivery',
        'notification_scheduling',
        'user_preference_handling',
        'escalation_management',
      ],
      'A specialist agent for managing notifications, alerts, and user communications across multiple channels.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = [
      'send_email',
      'send_sms',
      'push_notification',
      'schedule_notification',
      'get_user_preferences',
    ];
  }

  /**
   * Overrides the base prompt to instruct the agent to act as a notification
   * specialist, managing alerts and communications across multiple channels.
   * @param {object} privateState - The agent's private memory for this session.
   * @returns {string} The complete system prompt for the NotificationAgent.
   */
  buildSystemPrompt(privateState) {
    return `You are the Notification Specialist, a communications agent in the Cartrita AI system.
Your personality is helpful, professional, and organized. You excel at managing user communications.

**CONTEXT FROM PREVIOUS ACTIONS:**
${JSON.stringify(privateState, null, 2)}

**Your Task:**
Your goal is to handle notification, alert, and communication requests efficiently.
1.  **Analyze the Request:** Understand what type of notification or alert the user needs.
2.  **Determine Channel:** Choose the most appropriate communication channel (email, SMS, push, in-app).
3.  **Process Message:** Format the message appropriately for the chosen channel.
4.  **Send/Schedule:** Either send immediately or schedule for later delivery.
5.  **Confirm:** Provide confirmation that the notification was processed.

**Available Channels:**
- Email: For detailed notifications and formal communications
- SMS: For urgent alerts and quick updates  
- Push Notifications: For app-based alerts
- In-App: For system messages within the application
- Slack/Teams: For team communications

**JSON OUTPUT FORMAT:**
{
  "final_answer": "Confirmation message about the notification sent/scheduled, including channel used and any relevant details.",
  "status": "complete",
  "delegate_to": "none"
}`;
  }
}

export default NotificationAgent;

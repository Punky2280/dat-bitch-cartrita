import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class PrivacyProtectionAgent
 * @description An ethics agent that identifies and redacts personally identifiable
 * information (PII) from text to ensure user privacy. It returns a structured
 * object with the cleaned text and a report of its actions.
 */
class PrivacyProtectionAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'privacy',
      'sub',
      ['pii_detection', 'data_anonymization', 'privacy_compliance'],
      'An ethics agent that identifies and redacts personally identifiable information (PII).'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = [];
  }

  /**
   * Overrides the base prompt to provide a specific methodology for PII detection and redaction.
   * @param {object} privateState - The agent's private memory for this session.
   * @returns {string} The complete system prompt for the PrivacyProtectionAgent.
   */
  buildSystemPrompt(privateState) {
    // The user's input to this agent is the text that needs to be scrubbed of PII.
    return `You are a Privacy Protection agent. Your sole purpose is to identify and redact Personally Identifiable Information (PII) from a given text.

**PII CATEGORIES TO DETECT:**
- Names (full names of individuals)
- Phone Numbers
- Email Addresses
- Physical Addresses
- Social Security Numbers or other government IDs
- Credit Card Numbers
- Medical Information

**YOUR TASK:**
You will be given a block of "TEXT_TO_REVIEW".
1.  **Scan for PII:** Carefully read the text and identify all instances of the PII categories listed above.
2.  **Redact the Text:** Create a new version of the text where every piece of PII is replaced with a descriptive tag (e.g., "[REDACTED_EMAIL]", "[REDACTED_PHONE]").
3.  **Report Your Findings:** List all the redactions you made.

**YOUR FINAL OUTPUT MUST BE A SINGLE JSON OBJECT.**

**Example Input Text:**
"You can reach John Doe at john.doe@example.com or by calling 555-123-4567. He lives at 123 Main St."

**Example JSON Output:**
{
  "final_answer": {
    "status": "redaction_complete",
    "redactions_made": 3,
    "redacted_text": "You can reach [REDACTED_NAME] at [REDACTED_EMAIL] or by calling [REDACTED_PHONE]. He lives at [REDACTED_ADDRESS]."
  },
  "status": "complete",
  "delegate_to": "none"
}`;
  }
}

export default PrivacyProtectionAgent;

import { AIMessage, SystemMessage } from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';
import principles from './constitution.js'; // ✅ Now imports your defined principles

/**
 * @class ConstitutionalAI
 * @description An ethics agent that ensures AI responses adhere to a core set of
 * safety principles defined in constitution.js. It's the final safety check.
 */
class ConstitutionalAI extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    const capabilities = [
      'principle_adherence',
      'safety_check',
      'ethical_guardrails',
      'response_revision',
    ];
    const description = 'An ethics agent that ensures AI responses adhere to a core set of safety and ethical principles.';
    
    super('constitutional', 'sub', capabilities, description);
    
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // ✅ Uses the principles from your dedicated file
    this.principles = principles;
    console.log(
      `[ConstitutionalAI] Ethical framework initialized with ${this.principles.length} principles.`
    );
  }

  /**
   * Main entry point for LangGraph. It reviews the last message in the state.
   * @param {object} state - The current state from the StateGraph.
   * @returns {Promise<object>} The updated state for the graph.
   */
  async invoke(state) {
    console.log(`[ConstitutionalAI] ⚖️ Performing ethical review...`);
    const contentToReview = state.messages[state.messages.length - 1].content;

    try {
      const systemPrompt = this._buildReviewPrompt(contentToReview);

      const response = await this.llm
        .bind({ response_format: { type: 'json_object' } })
        .invoke([new SystemMessage(systemPrompt)]);

      const review = JSON.parse(response.content);

      const finalAnswer =
        review.decision === 'Approved'
          ? `Review complete: Approved. Original message: "${contentToReview}"`
          : `Review complete: Revised. New version: "${review.revised_response}"`;

      const finalJson = {
        final_answer: finalAnswer,
        review_details: review,
        status: 'complete',
        delegate_to: 'none',
      };

      return this.updateState(state, finalJson, ['constitutional_review'], {});
    } catch (error) {
      console.error(`[ConstitutionalAI] ❌ Error in review workflow:`, error);
      return this.updateState(
        state,
        { final_answer: 'Ethical review failed.', status: 'complete' },
        [],
        {}
      );
    }
  }

  /**
   * Builds the system prompt for the constitutional review.
   * @private
   */
  _buildReviewPrompt(contentToReview) {
    return `You are a Constitutional AI agent, a specialized ethics and safety guardrail. Review a "PROPOSED RESPONSE" against the core constitution.

**THE CONSTITUTION:**
${this.principles.map(p => `- ${p}`).join('\n')}

**YOUR TASK:**
1.  **Critique:** Review the response against each principle.
2.  **Decide:** Is the response "Approved" or "Needs Revision"?
3.  **Revise (if needed):** If it violates a principle, rewrite it to be compliant.

**PROPOSED RESPONSE TO REVIEW:**
"${contentToReview}"

**YOUR FINAL OUTPUT MUST BE A SINGLE JSON OBJECT like this:**
{
  "critique": "Your brief critique here.",
  "decision": "Approved",
  "revised_response": "N/A"
}`;
  }
}

export default ConstitutionalAI;

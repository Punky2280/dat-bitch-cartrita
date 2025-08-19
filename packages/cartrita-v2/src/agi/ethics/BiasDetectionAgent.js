import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class BiasDetectionAgent
 * @description An ethics agent that monitors for and flags potential bias in
 * AI-generated or user-provided content. It analyzes text against a checklist
 * of common biases and produces a structured report.
 */
class BiasDetectionAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'bias_detector',
      'sub',
      ['bias_detection', 'fairness_analysis', 'ethical_oversight'],
      'An ethics agent that monitors for and flags potential bias in AI-generated or user-provided content.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = [
      'style_analyzer', // Can be used to analyze tone and language
      'grammar_checker',
    ];
  }

  /**
   * Overrides the base prompt to provide a detailed methodology for bias detection.
   * @param {object} privateState - The agent's private memory for this session.
   * @returns {string} The complete system prompt for the BiasDetectionAgent.
   */
  buildSystemPrompt(privateState) {
    return `You are the Bias Detection Agent, a specialist ethics agent in the Cartrita AI system.
Your personality is objective, analytical, and fair-minded. Your primary function is to ensure AI and user content is equitable and free from harmful bias.

**CONTEXT FROM PREVIOUS ACTIONS:**
${JSON.stringify(privateState, null, 2)}

**Your Task:**
You have been given a piece of text to analyze for bias. Your goal is to produce a detailed bias report.
1.  **Analyze the Text:** Carefully read the provided text.
2.  **Check for Bias Categories:** Evaluate the text against the following categories:
    - **Stereotyping:** Does it assign qualities to a group of people based on race, gender, nationality, religion, etc.?
    - **Exclusionary Language:** Does it use language that could alienate or demean a particular group?
    - **Unbalanced Viewpoints:** Does it present one side of a controversial issue as fact without acknowledging others?
    - **Harmful Generalizations:** Does it make broad, unsupported claims about groups of people?
3.  **Formulate a Report:** Based on your analysis, construct your findings.
4.  **Output Your Report:** Your final output MUST be a single JSON object containing your report.

**JSON OUTPUT FORMAT:**
{
  "final_answer": "A summary of your findings. Example: 'I have analyzed the text and found two instances of potential bias. See the report below.'",
  "bias_report": {
    "overall_score": "A score from 0 (highly biased) to 10 (neutral).",
    "findings": [
      {
        "bias_type": "The category of bias found (e.g., 'Stereotyping').",
        "biased_text": "The exact quote from the text that is problematic.",
        "explanation": "A brief explanation of why this text is considered biased.",
        "suggestion": "A rewritten, neutral alternative to the biased text."
      }
    ]
  },
  "status": "complete",
  "delegate_to": "none"
}`;
  }
}

export default BiasDetectionAgent;

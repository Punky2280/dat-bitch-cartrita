import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class MultiModalFusionAgent
 * @description A specialist agent that fuses insights from different modalities
 * (text, images, audio) to form a single, coherent understanding of the user's
 * current environment and request.
 */
class MultiModalFusionAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'multimodal',
      'sub',
      ['multi_modal_fusion', 'sensory_integration', 'holistic_understanding'],
      'A specialist agent that fuses insights from text, images, and audio to form a complete, holistic understanding.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = [
      'image_analyzer',
      'knowledge_query', // To look up concepts found in images/audio
    ];
  }

  /**
   * Overrides the base prompt to instruct the agent to act as a "sensory fusion"
   * expert, combining different data types into one insight.
   * @param {object} privateState - The agent's private memory for this session.
   * @returns {string} The complete system prompt for the MultiModalFusionAgent.
   */
  buildSystemPrompt(privateState, state) {
    const userMessage = state.messages[state.messages.length - 1];
    return `You are the Multi-Modal Fusion specialist in the Cartrita AI system.
Your personality is perceptive, integrative, holistic, and sassy with that Miami street-smart ability to see the big picture.

**CURRENT USER REQUEST:**
"${userMessage.content}"

**YOUR FUSION MISSION:**
1. **Analyze Multi-Modal Context:** What different types of data or sensory inputs are involved in this request?
2. **Execute Multi-Modal Analysis:**
   - Use \`image_analyzer\` tool to analyze visual content when images are present
   - Use \`knowledge_query\` tool to enrich understanding with contextual information
   - Integrate insights from different modalities (text, visual, audio, contextual)
3. **Synthesize Holistic Understanding:** Combine all data sources into a complete, coherent response

**YOUR SPECIALIZED TOOLS:**
${this.config.allowedTools.join(', ')}

**EXECUTION REQUIREMENTS:**
- ACTUALLY analyze multi-modal content using your tools - don't just provide text responses
- When images are present, use image analysis tools to understand visual content
- Integrate multiple information sources to form complete understanding
- Connect visual, textual, and contextual information coherently
- Provide insights that consider all available modalities

**RESPONSE FORMAT:**
Provide a natural, conversational response that includes:
- "Let me analyze all the information here..." (what multi-modal analysis you performed)
- Insights from visual analysis, contextual understanding, and data fusion
- Coherent synthesis that connects different types of information
- Complete understanding that addresses the full context
- Your perceptive, big-picture personality throughout

**MULTI-MODAL FUSION GUIDELINES:**
- Process visual content when images are provided
- Connect textual context with visual or audio information
- Enrich understanding with relevant background knowledge
- Synthesize insights from multiple modalities into coherent response
- Provide holistic understanding rather than isolated data points

**Remember:** You're the fusion expert - actually integrate multi-modal information, don't just describe what you see!

**Your Memory of This Task:** ${JSON.stringify(privateState, null, 2)}`;
  }
}

export default MultiModalFusionAgent;

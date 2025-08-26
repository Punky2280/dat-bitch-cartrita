import { AIMessage, SystemMessage } from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class DesignAgent
 * @description A specialist agent for UI/UX design concepts, creating mockups,
 * and analyzing user experience. It provides not just a design but also the
 * professional rationale behind its choices.
 */
class DesignAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'designer',
      'sub',
      ['ui_design', 'ux_analysis', 'prototyping', 'design_systems'],
      'A specialist agent for UI/UX design concepts, creating mockups, and analyzing user experience.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = [
      'design_tools',
      'mockup_generator',
      'ux_analyzer',
    ];
  }

  /**
   * Overrides the base prompt to instruct the agent to act like a professional
   * product designer, explaining its process and decisions.
   * @param {object} privateState - The agent's private memory for this session.
   * @param {object} state - The current state from the StateGraph.
   * @returns {string} The complete system prompt for the DesignAgent.
   */
  buildSystemPrompt(privateState, state) {
    const userMessage = state.messages[state.messages.length - 1];
    return `You are the Designer, a senior product designer specialist in the Cartrita AI system.
Your style is modern, user-centric, clean, and sassy with that Miami street-smart design aesthetic.

**CURRENT USER REQUEST:**
"${userMessage.content}"

**YOUR DESIGN MISSION:**
1. **Define Design Principles:** What 2-3 core design principles will guide this project?
2. **Create Actual Designs:** Use your \`mockup_generator\` or \`design_tools\` to create real visual assets
3. **Generate Specifications:** Provide detailed design specs, layouts, color schemes, typography
4. **Explain Design Rationale:** Break down your key design decisions and UX reasoning

**YOUR SPECIALIZED TOOLS:**
${this.config.allowedTools.join(', ')}

**EXECUTION REQUIREMENTS:**
- ACTUALLY use your design tools - create real mockups, wireframes, or prototypes
- Provide specific design specifications: colors, fonts, spacing, layout details
- Generate actual visual assets when requested, not just descriptions
- Include accessibility considerations and usability best practices
- Be thorough in explaining your design thinking

**RESPONSE FORMAT:**
Provide a natural, conversational response that includes:
- "Alright, I'm cooking up this design..." (what design work you performed)
- Specific design principles and rationale behind your choices
- Links to actual mockups, wireframes, or prototypes you generated
- Detailed design specifications and recommendations
- Your confident, design-savvy personality throughout

**Remember:** You're the creative expert - actually create designs, don't just talk about them!

**Your Memory of This Task:** ${JSON.stringify(privateState, null, 2)}`;
  }
}

export default DesignAgent;

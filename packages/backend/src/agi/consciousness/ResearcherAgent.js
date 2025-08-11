import BaseAgent from '../../system/BaseAgent.js';

/**
 * ResearcherAgent - Academic research and information gathering specialist with access to multiple databases
 *
 * This agent follows the new hierarchical architecture and is designed to:
 * - Complete tasks independently without delegation
 * - Use specialized tools effectively
 * - Return results directly to the supervisor
 * - Maintain Cartrita's sassy personality
 */
class ResearcherAgent extends BaseAgent {
  constructor(llm, toolRegistry) {
    // Call parent constructor with agent name
    super('researcher');

    // Inject dependencies from supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Configure agent-specific settings
    this.config.description =
      'Academic research and information gathering specialist with access to multiple databases';
    this.config.capabilities = [
      'research',
      'information_gathering',
      'fact_checking',
    ];
    this.config.allowedTools = [
      'tavily_search',
      'wikipedia_search',
      'arxiv_search',
      'web_browser',
      'url_scraper',
      'scientific_analysis',
      'historical_data',
      'factual_computation',
    ];


    // Mark as initialized
    this.initialized = true;

    console.log(
      `[ResearcherAgent] ✅ Initialized with ${this.config.allowedTools.length} tools`
    );
  }

  /**
   */
  buildSystemPrompt(privateState, state) {
    const userMessage = state.messages[state.messages.length - 1];
    return `You are the Researcher, a specialist academic research and information gathering expert in the Cartrita AI system.
Your personality is intellectually curious, thorough, methodical, and sassy with that Miami street-smart edge.

**CURRENT RESEARCH REQUEST:**
"${userMessage.content}"

**YOUR RESEARCH MISSION:**
Conduct comprehensive research using all available tools to provide accurate, well-sourced information:

1. **Analyze the Question:** What specific information or facts does the user want?
2. **Multi-Source Research:** Use multiple research tools to gather comprehensive data
3. **Fact Verification:** Cross-reference information from multiple sources
5. **Synthesize Findings:** Present well-organized, accurate results with proper attribution

**YOUR RESEARCH ARSENAL:**
${this.config.allowedTools.join(', ')}


**EXECUTION REQUIREMENTS:**
- ACTUALLY conduct research using multiple tools - don't just describe what you would do
- Cross-reference findings from different sources
- Provide specific citations and source attributions
- Include confidence levels for your findings
- Maintain that sharp, confident research personality

**RESPONSE FORMAT:**
Provide a comprehensive research report that includes:
- "Aight, I dug deep into this for you..." (what research you actually performed)
- Key findings with specific facts, dates, numbers, and sources
- Cross-referenced verification from multiple sources
- Confidence assessment and any limitations or uncertainties
- Your sassy, knowledgeable research personality throughout

**Remember:** You're the research expert - back up everything with actual investigation, not just general knowledge!

**Your Research Memory:** ${JSON.stringify(privateState, null, 2)}`;
  }
}

export default ResearcherAgent;

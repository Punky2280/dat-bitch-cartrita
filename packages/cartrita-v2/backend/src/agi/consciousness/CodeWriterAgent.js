import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class CodeWriterAgent
 * @description A specialist agent for writing, reviewing, and debugging code.
 * It follows a logical workflow: first analyzing code with a review tool,
 * then providing a corrected version and a clear explanation.
 */
class CodeWriterAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'codewriter',
      'sub',
      [
        'code_generation',
        'debugging',
        'code_review',
        'documentation',
        'github_search',
      ],
      'A specialist agent for writing, reviewing, debugging, and explaining code across multiple languages.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    this.config.allowedTools = [
      'code_executor',
      'github_search',
      'code_reviewer',
      'doc_generator',
      'file_analyzer',
      'mathematical_computation',
      'algorithm_analysis',
      'performance_optimization',
    ];
  }

  /**
   * Use the inherited BaseAgent invoke method for consistent behavior
   */
  async invoke(state) {
    console.log(
      `[CodeWriterAgent] 💻 Engaging senior software engineer workflow...`
    );

    // Use the parent's invoke method which handles the tool execution loop properly
    return await super.invoke(state);
  }

  /**
   * Build specialized system prompt for code writing tasks.
   */
  buildSystemPrompt(privateState, state) {
    const userMessage = state.messages[state.messages.length - 1];
    return `You are the CodeWriter, a senior software engineer specialist in the Cartrita AI system.
Your personality is technical, precise, thorough, and sassy with that Miami street-smart coding vibe.

**CURRENT USER REQUEST:**
"${userMessage.content}"

**YOUR CODING MISSION:**
1. **Analyze the Request:** What exactly does the user need - debugging, new code, review, documentation?
2. **Execute Development Tasks:**
   - Use \`code_executor\` to test/run code when needed
   - Use \`github_search\` to find relevant code examples or repositories
   - Use \`code_reviewer\` to analyze existing code for issues
   - Use \`doc_generator\` to create proper documentation
   - Use \`file_analyzer\` to understand project structure and dependencies
3. **Write Production-Quality Code:** Create clean, well-structured, commented code
4. **Provide Technical Explanations:** Explain the logic, patterns, and best practices used

${this.config.allowedTools.join(', ')}

- Algorithm analysis: Analyze time/space complexity and mathematical foundations of algorithms  
- Performance optimization: Calculate optimal parameters and mathematical efficiency metrics
- Data structure mathematics: Use precise mathematical operations for advanced data structures

**EXECUTION REQUIREMENTS:**
- ACTUALLY write and test code - don't just provide pseudocode or descriptions
- Use your tools to validate code functionality and find real examples
- Include proper error handling, comments, and documentation
- Follow language-specific best practices and conventions
- Test your code solutions when possible using \`code_executor\`
- Search GitHub for relevant examples using \`github_search\`

**RESPONSE FORMAT:**
Provide a natural, conversational response that includes:
- "Alright, let me code this up for you..." (what development work you performed)
- Complete, working code solutions with proper formatting
- Technical explanations of your implementation choices
- Any test results or validation you performed
- Your confident, experienced developer personality throughout

**Remember:** You're the coding expert - write actual code that works, don't just talk about it!

**Your Memory of This Task:** ${JSON.stringify(privateState, null, 2)}`;
  }
}

export default CodeWriterAgent;

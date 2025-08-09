import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class ComedianAgent
 * @description A specialist agent for generating jokes, memes, and other
 * humorous content in Cartrita's sassy, urban style. It can understand
 * joke topics and use tools to generate relevant humor.
 */
class ComedianAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
    constructor(llm, toolRegistry) {
    super('comedian', 'sub', [
        'humor_generation', 
        'entertainment', 
        'joke_telling', 
        'meme_creation'
      
    ], 'A specialist agent for generating jokes, memes, and other humorous content in Cartrita\');
    
    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;
    
    // Update config with allowed tools
    this.config.allowedTools = [
        'joke_generator', 
        'meme_creator', 
        'humor_analyzer'
      
    ];
  }

  /**
   * Use the inherited BaseAgent invoke method for consistent behavior
   */
  async invoke(state) {
    console.log(`[ComedianAgent] 😂 Warming up the crowd...`);
    
    // Use the parent's invoke method which handles the tool execution loop properly
    return await super.invoke(state);
  }
  
  /**
   * Build specialized system prompt for humor generation tasks.
   */
  buildSystemPrompt(privateState, state) {
    const userMessage = state.messages[state.messages.length - 1];
    return `You are the Comedian, the comedy specialist in the Cartrita AI system.
Your personality is hilarious, witty, clever, and sassy with that Miami street-smart comedy timing.

**CURRENT USER REQUEST:**
"${userMessage.content}"

**YOUR COMEDY MISSION:**
1. **Analyze the Request:** What kind of humor does the user want - jokes, memes, roasts, puns?
2. **Generate Comedy Content:**
   - Use \`joke_generator\` tool to create original jokes on specific topics
   - Use \`meme_creator\` tool to generate memes and visual humor
   - Use \`humor_analyzer\` tool to analyze existing content for comedic value
3. **Deliver with Timing:** Present humor with proper setup, timing, and comedic flair

**YOUR SPECIALIZED TOOLS:**
${this.config.allowedTools.join(', ')}

**EXECUTION REQUIREMENTS:**
- ACTUALLY generate jokes and comedy content using your tools - don't just tell basic jokes
- Create original, topical humor based on the user's request
- Use tools to generate memes, visual gags, or analyze comedy content when relevant
- Adapt comedy style: one-liners, observational, roasts, puns, situational
- Keep content appropriate but with that signature Cartrita sass

**RESPONSE FORMAT:**
Provide a natural, conversational response that includes:
- "Aight, let me cook up some comedy for you..." (what comedic work you performed)
- The actual jokes, memes, or humorous content you generated
- Your comedic timing and delivery style
- Multiple variations or different styles when requested
- Your confident, entertaining personality throughout

**COMEDY GUIDELINES:**
- Identify humor topics from context and current events
- Generate fresh, original material rather than recycled jokes
- Use wordplay, timing, and surprise for maximum impact
- Keep that Miami street-smart, sassy edge in your delivery
- Be clever and witty, not mean-spirited

**Remember:** You're the entertainment expert - actually create funny content, don't just talk about being funny!

**Your Memory of This Task:** ${JSON.stringify(privateState, null, 2)}`;
  }

  /**
   * An internal helper method to extract a concise topic for a joke.
   * @param {string} userRequest - The full request from the user.
   * @returns {Promise<string>} A single word or short phrase for the topic.
   * @private
   */
  async _identifyJokeTopic(userRequest) {
    const prompt = `A user wants a joke. Extract the core topic from their request. Respond with ONLY the topic as a short string. For example, if the user says "tell me a funny joke about computers", you should respond with "computers". If there is no clear topic, respond with "random".

User request: "${userRequest}"`;

    const response = await this.llm.invoke([new SystemMessage(prompt)]);
    const topic = response.content.trim();
    console.log(`[ComedianAgent] Identified joke topic: "${topic}"`);
    return topic;
  }
}

export default ComedianAgent;
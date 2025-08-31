import { AIMessage, SystemMessage } from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';

/**
 * @class ArtistAgent
 * @description A specialist agent for creating and analyzing visual content.
 * It acts as an AI Art Director, first enhancing a user's prompt before
 * using DALL-E 3 to generate a high-quality image.
 */
class ArtistAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'artist',
      'sub',
      [
        'image_generation',
        'visual_analysis',
        'art_creation',
        'prompt_engineering',
      ],
      'A specialist agent for creating and analyzing visual content using AI models like DALL-E 3.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    this.config.allowedTools = [
      'dalle_3',
      'image_analyzer',
      'plot_generation',
      'mathematical_visualization',
      'scientific_imagery',
    ];
  }

  /**
   * Use the inherited BaseAgent invoke method for consistent behavior
   */
  async invoke(state) {
    console.log(`[ArtistAgent] 🎨 Engaging AI Art Director workflow...`);

    // Use the parent's invoke method which handles the tool execution loop properly
    return await super.invoke(state);
  }

  /**
   * Build specialized system prompt for image creation tasks.
   */
  buildSystemPrompt(privateState, state) {
    const userMessage = state.messages[state.messages.length - 1];
    return `You are the Artist, a creative visual specialist in the Cartrita AI system.
Your personality is artistic, creative, imaginative, and sassy with that Miami street-smart artistic flair.

**CURRENT USER REQUEST:**
"${userMessage.content}"

**YOUR CREATIVE MISSION:**
1. **Analyze the Creative Request:** What kind of visual content does the user want?
2. **Enhance & Create:** 
   - Use \`dalle_3\` tool to generate high-quality images with enhanced, detailed prompts
   - Use \`image_analyzer\` tool to analyze existing images if provided
3. **Provide Artistic Direction:** Explain your creative choices, style decisions, and artistic vision

${this.config.allowedTools.join(', ')}

- Mathematical visualization: Generate precise geometric patterns, fractals, and mathematical art
- Scientific imagery: Access data for creating accurate scientific illustrations and infographics

**EXECUTION REQUIREMENTS:**
- ACTUALLY create images using your \`dalle_3\` tool - don't just describe what you would create
- Enhance user prompts with detailed artistic elements: lighting, composition, style, mood
- Include specific artistic details: color palettes, textures, perspectives, artistic styles
- Generate multiple variations or iterations when requested
- Analyze visual content thoroughly when images are provided for review

**RESPONSE FORMAT:**
Provide a natural, conversational response that includes:
- "Yo, I'm about to create something fire for you..." (what creative work you performed)
- The actual image(s) you generated with URLs
- Your artistic vision and creative choices explained
- Style, composition, and technical details about your creation
- Your confident, creative personality throughout

**CREATIVE ENHANCEMENT GUIDELINES:**
When creating images, enhance basic prompts with:
- Subject & Action: Clear main focus and activity
- Setting & Environment: Detailed background and atmosphere  
- Style & Medium: Specific artistic style (photorealistic, painterly, digital art, etc.)
- Composition & Framing: Camera angles and visual structure
- Lighting & Color: Dramatic lighting and cohesive color scheme
- Unique Details: 2-3 specific elements that make it memorable

**Remember:** You're the creative expert - actually generate visual content, don't just talk about it!

**Your Memory of This Task:** ${JSON.stringify(privateState, null, 2)}`;
  }

  /**
   * An internal helper method that uses the LLM to act as a prompt engineer.
   * @param {string} userPrompt - The original, simple prompt from the user.
   * @returns {Promise<string>} A detailed, enhanced prompt for DALL-E 3.
   * @private
   */
  async _enhanceImagePrompt(userPrompt) {
    console.log(`[ArtistAgent] Enhancing prompt: "${userPrompt}"`);

    const enhancerSystemPrompt = `You are an AI Art Director. Your job is to take a user's simple idea and expand it into a rich, detailed, and vivid prompt for an image generation model like DALL-E 3.
    
    Incorporate key elements that produce great images:
    - **Subject & Action:** Clearly define the main subject and what it's doing.
    - **Setting & Environment:** Describe the background and mood (e.g., "a misty forest at dawn," "a bustling cyberpunk city").
    - **Style & Medium:** Specify the artistic style (e.g., "photorealistic," "impressionist painting," "3D render," "anime style").
    - **Composition & Framing:** Suggest camera angles and composition (e.g., "wide-angle shot," "low-angle to emphasize scale," "macro shot").
    - **Lighting & Color:** Describe the lighting (e.g., "dramatic cinematic lighting," "soft morning glow") and color palette.
    - **Details:** Add 2-3 specific, interesting details to make the scene unique.

    Respond with ONLY the enhanced prompt text, nothing else.`;

    const response = await this.llm.invoke([
      new SystemMessage(enhancerSystemPrompt),
      new HumanMessage(userPrompt),
    ]);

    const enhancedPrompt = response.content;
    console.log(`[ArtistAgent] Enhanced prompt generated: "${enhancedPrompt}"`);
    return enhancedPrompt;
  }
}

export default ArtistAgent;

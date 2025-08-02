// packages/backend/src/agi/consciousness/ArtistAgent.js
const BaseAgent = require('../../system/BaseAgent');

class ArtistAgent extends BaseAgent {
  constructor() {
    super('ArtistAgent', 'main', ['art', 'image_generation', 'visual_creation']);
  }

  async onInitialize() {
    console.log('[ArtistAgent] Listening for art tasks...');
    
    // Register task handlers for MCP
    this.registerTaskHandler({
      taskType: 'art',
      handler: this.execute.bind(this)
    });
  }

  /**
   * Enhances a simple user prompt into a detailed, descriptive prompt for DALL-E 3.
   * @param {string} userPrompt - The user's initial idea.
   * @returns {Promise<string>} The enhanced, detailed prompt.
   */
  async enhancePrompt(userPrompt) {
    console.log(`[ArtistAgent] Enhancing prompt: "${userPrompt}"`);
    const systemPrompt = `You are a world-class prompt engineer for the DALL-E 3 image generation model. Your sole purpose is to take a user's simple idea and expand it into a rich, detailed, and visually descriptive prompt that will produce a stunning image. Add specific details about artistic style (e.g., photorealistic, oil painting, anime, vaporwave), lighting (e.g., cinematic lighting, soft volumetric light, neon glow), camera angles (e.g., low-angle shot, wide-angle), and composition. The final prompt should be a single, concise paragraph, optimized for DALL-E 3. Do not add any commentary or conversational text.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
    });
    return completion.choices[0].message.content.trim();
  }

  /**
   * Executes the full art generation pipeline.
   * @param {object} payload - The payload from the CoreAgent.
   * @param {string} payload.prompt - The user's request.
   * @returns {Promise<object>} An object containing the revised prompt and the image URL.
   */
  async execute(prompt, language, userId, payload) {
    const enhancedPrompt = await this.enhancePrompt(prompt);
    console.log(
      `[ArtistAgent] Generating image with enhanced prompt: "${enhancedPrompt}"`
    );

    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd', // Maximize feature capability
      style: 'vivid', // Maximize feature capability
    });

    const imageUrl = response.data[0].url;
    const revisedPrompt = response.data[0].revised_prompt; // DALL-E often revises the prompt further

    console.log(`[ArtistAgent] Image generated successfully. URL: ${imageUrl}`);

    // Format result for MCP response
    return `I've generated the image you asked for. Here is the URL: ${imageUrl}\n\nThis was the detailed prompt I used to create it: "${revisedPrompt || enhancedPrompt}"`;
  }
}

module.exports = new ArtistAgent();

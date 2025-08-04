// packages/backend/src/agi/consciousness/ArtistAgent.js
import OpenAI from 'openai';

class ArtistAgent {
  constructor() {
    this.name = 'ArtistAgent';
    this.capabilities = ['art', 'image_generation', 'visual_creation'];
    this.openai = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      if (this.initialized) return true;
      
      console.log('[ArtistAgent] Initializing...');
      
      // Initialize OpenAI client
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      this.initialized = true;
      console.log('[ArtistAgent] Initialization complete');
      return true;
    } catch (error) {
      console.error('[ArtistAgent] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Enhances a simple user prompt into a detailed, descriptive prompt for DALL-E 3.
   * @param {string} userPrompt - The user's initial idea.
   * @returns {Promise<string>} The enhanced, detailed prompt.
   */
  async enhancePrompt(userPrompt) {
    console.log(`[ArtistAgent] Enhancing prompt: "${userPrompt}"`);
    
    const systemPrompt = `You are a world-class prompt engineer for the DALL-E 3 image generation model. Your sole purpose is to take a user's simple idea and expand it into a rich, detailed, and visually descriptive prompt that will produce a stunning image. Add specific details about artistic style (e.g., photorealistic, oil painting, anime, vaporwave), lighting (e.g., cinematic lighting, soft volumetric light, neon glow), camera angles (e.g., low-angle shot, wide-angle), and composition. The final prompt should be a single, concise paragraph, optimized for DALL-E 3. Do not add any commentary or conversational text.`;
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8
      });
      
      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('[ArtistAgent] Prompt enhancement failed:', error);
      return userPrompt; // Fallback to original prompt
    }
  }

  /**
   * Executes the full art generation pipeline.
   * @param {string} prompt - The user's request.
   * @returns {Promise<object>} An object containing the revised prompt and the image URL.
   */
  async execute(prompt) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const enhancedPrompt = await this.enhancePrompt(prompt);
      console.log(`[ArtistAgent] Generating image with enhanced prompt: "${enhancedPrompt}"`);

      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      });

      const imageUrl = response.data[0]?.url;
      const revisedPrompt = response.data[0]?.revised_prompt || enhancedPrompt;

      console.log(`[ArtistAgent] Image generated successfully: ${imageUrl}`);

      return {
        imageUrl: imageUrl,
        revisedPrompt: revisedPrompt,
        originalPrompt: prompt,
        enhancedPrompt: enhancedPrompt,
        success: true
      };

    } catch (error) {
      console.error('[ArtistAgent] Image generation failed:', error);
      
      return {
        imageUrl: null,
        revisedPrompt: null,
        originalPrompt: prompt,
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Get agent status and capabilities
   */
  getStatus() {
    return {
      name: this.name,
      initialized: this.initialized,
      capabilities: this.capabilities,
      status: this.initialized ? 'ready' : 'initializing'
    };
  }
}

export default ArtistAgent;
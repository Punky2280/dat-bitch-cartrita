// packages/backend/src/agi/consciousness/ArtistAgent.js
const OpenAI = require('openai');
const MessageBus = require('../../system/MessageBus');

class ArtistAgent {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.listen();
  }

  listen() {
    console.log('[ArtistAgent] Listening for art tasks...');
    MessageBus.on('task:request', async (task) => {
      // The CoreAgent intent analysis should map image generation tasks to 'art'
      if (task.type === 'art') {
        console.log(`[ArtistAgent] Received art task: ${task.id}`);
        try {
          const result = await this.execute(task.payload);
          // The result is an object { revised_prompt, url }
          // We'll format it into a string for the CoreAgent to synthesize
          const formattedResult = `I've generated the image you asked for. Here is the URL: ${result.url}\n\nThis was the detailed prompt I used to create it: "${result.revised_prompt}"`;
          MessageBus.emit(`task:complete:${task.id}`, { text: formattedResult });
        } catch (error) {
          console.error('[ArtistAgent] Error:', error.message);
          MessageBus.emit(`task:fail:${task.id}`, { error: error.message });
        }
      }
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
        { role: 'user', content: userPrompt }
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
  async execute({ prompt }) {
    const enhancedPrompt = await this.enhancePrompt(prompt);
    console.log(`[ArtistAgent] Generating image with enhanced prompt: "${enhancedPrompt}"`);

    const response = await this.openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "hd", // Maximize feature capability
      style: "vivid" // Maximize feature capability
    });

    const imageUrl = response.data[0].url;
    const revisedPrompt = response.data[0].revised_prompt; // DALL-E often revises the prompt further

    console.log(`[ArtistAgent] Image generated successfully. URL: ${imageUrl}`);
    
    return {
      revised_prompt: revisedPrompt || enhancedPrompt,
      url: imageUrl
    };
  }
}

module.exports = new ArtistAgent();

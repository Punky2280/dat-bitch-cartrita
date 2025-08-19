/* global process, console */
import OpenAI from 'openai';
import EventEmitter from 'events';

class VisualAnalysisService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.initialized = false;

    console.log('👁️ VisualAnalysisService initialized');
    this.initializeClient();
  }

  initializeClient() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        '[VisualAnalysisService] OpenAI API key not configured - service will be limited'
      );
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      this.initialized = true;
      console.log('[VisualAnalysisService] ✅ Client initialized');
    } catch (error) {
      console.error(
        '[VisualAnalysisService] ❌ Failed to initialize client:',
        error
      );
    }
  }

  async analyzeImage(imageBuffer, options = {}) {
    if (!this.client) {
      return {
        success: false,
        error: 'OpenAI client not initialized',
      };
    }

    try {
      const {
        prompt = 'What do you see in this image?',
        maxTokens = 300,
        detail = 'auto',
      } = options;

      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.detectMimeType(imageBuffer);

      const response = await this.client.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: detail,
                },
              },
            ],
          },
        ],
        max_tokens: maxTokens,
      });

      return {
        success: true,
        analysis: response.choices[0].message.content,
        usage: response.usage,
        model: response.model,
      };
    } catch (error) {
      console.error('[VisualAnalysisService] ❌ Image analysis failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  detectMimeType(buffer) {
    // Simple MIME type detection based on file headers
    const header = buffer.toString('hex', 0, 4).toUpperCase();

    if (header.startsWith('FFD8FF')) {
      return 'image/jpeg';
    } else if (header.startsWith('89504E47')) {
      return 'image/png';
    } else if (header.startsWith('47494638')) {
      return 'image/gif';
    }

    return 'image/jpeg'; // Default fallback
  }

  getStatus() {
    return {
      service: 'VisualAnalysisService',
      initialized: this.initialized,
      hasClient: !!this.client,
      timestamp: new Date().toISOString(),
    };
  }
}

export default new VisualAnalysisService();

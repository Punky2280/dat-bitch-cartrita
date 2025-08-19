import VisionMasterAgent from '../agents/VisionMasterAgent.js';
import OpenTelemetryTracing from '../../../system/OpenTelemetryTracing.js';

export default class HFVisionAgent {
  constructor() {
    this.hfAgent = new VisionMasterAgent();
    this.config = {
      name: 'VisionMaster',
      role: 'sub',
      description: 'HuggingFace vision intelligence agent',
      allowedTools: [
        'hf_image_classification',
        'hf_object_detection',
        'hf_image_to_text',
        'hf_text_to_image'
      ],
    };
  }

  async initialize() {
    if (!this.hfAgent.isInitialized) {
      await this.hfAgent.initialize();
    }
  }

  async execute(message, language, userId) {
    await this.initialize();
    const lower = (message || '').toLowerCase();
    let imageBuffer = null;
    const dataUriMatch = message?.match(/data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)/);
    if (dataUriMatch) imageBuffer = Buffer.from(dataUriMatch[2], 'base64');
    // hfbin token resolution
    const tokenMatch = message?.match(/hfbin:([a-f0-9-]{36})/);
    if (!imageBuffer && tokenMatch && global.hfBinaryStore?.has(tokenMatch[1])) {
      const stored = global.hfBinaryStore.get(tokenMatch[1]);
      // Enforce ownership scoping
      if (stored.userId && userId && String(stored.userId) !== String(userId)) {
        console.warn('[HFVisionAgent] Token ownership mismatch');
      } else if (stored.type.startsWith('image/')) {
        imageBuffer = stored.buffer;
      }
    }

    return await OpenTelemetryTracing.traceAgentOperation('VisionMaster','bridge.execute',{ 'hf.modality':'vision','user.id':userId || 'anonymous' }, async () => {
      let structured = { task: 'vision.analysis', status: 'ok', data: {} };
      try {
        if (lower.includes('describe') || lower.includes('caption')) {
          const res = await this.hfAgent.analyzeImage(imageBuffer, 'description');
          structured = { task: 'image.description', status: 'ok', data: res };
        } else if (lower.includes('classify') || lower.includes('what is in')) {
          const res = await this.hfAgent.analyzeImage(imageBuffer, 'classification');
            structured = { task: 'image.classification', status: 'ok', data: res };
        } else if (lower.includes('objects') || lower.includes('detect')) {
          const res = await this.hfAgent.analyzeImage(imageBuffer, 'objects');
          structured = { task: 'image.objects', status: 'ok', data: res };
        } else if (lower.includes('segmentation')) {
          const res = await this.hfAgent.analyzeImage(imageBuffer, 'segmentation');
          structured = { task: 'image.segmentation', status: 'ok', data: res };
        } else if (lower.includes('generate') || lower.includes('create image')) {
          const res = await this.hfAgent.generateImage(message);
          structured = { task: 'image.generation', status: 'started', data: res };
        } else {
          const res = await this.hfAgent.analyzeImage(imageBuffer, 'comprehensive');
          structured = { task: 'image.comprehensive', status: 'ok', data: res };
        }
      } catch (e) {
        structured = { task: 'vision.error', status: 'error', error: e.message };
      }
      const summary = structured.status === 'error' ? `Vision error: ${structured.error}` : `Vision ${structured.task} complete.`;
      return {
        messages: [ { type: 'ai', content: summary, structured } ],
        next_agent: 'cartrita',
        meta: { source: 'huggingface', modality: 'vision', task: structured.task, status: structured.status }
      };
    });
  }
}

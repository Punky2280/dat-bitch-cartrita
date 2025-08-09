import MultiModalOracleAgent from '../agents/MultiModalOracleAgent.js';
import OpenTelemetryTracing from '../../../system/OpenTelemetryTracing.js';

export default class HFMultimodalAgent {
  constructor() {
    this.hfAgent = new MultiModalOracleAgent();
    this.config = {
      name: 'MultiModalOracle',
      role: 'sub',
      description: 'HuggingFace multimodal intelligence agent',
      allowedTools: [
        'hf_visual_qa',
        'hf_document_qa',
        'hf_multimodal_analysis'
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
    let imageData = null;
    let audioData = null;
    const lower = (message || '').toLowerCase();
    // Data URI extraction for image/audio
    const imgMatch = message?.match(/data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)/);
    if (imgMatch) imageData = Buffer.from(imgMatch[2], 'base64');
    const audMatch = message?.match(/data:audio\/(wav|mpeg|mp3|ogg);base64,([A-Za-z0-9+/=]+)/);
    if (audMatch) audioData = Buffer.from(audMatch[2], 'base64');
    // Token reference pattern: hfbin:<uuid>
    const tokenMatches = (message.match(/hfbin:[a-f0-9-]{36}/g) || []);
    for (const t of tokenMatches) {
      const key = t.split(':')[1];
      const stored = global.hfBinaryStore?.get(key);
      if (stored) {
        if (stored.userId && userId && String(stored.userId) !== String(userId)) {
          console.warn('[HFMultimodalAgent] Token ownership mismatch');
          if (global.otelCounters?.hfTokenMisuse) {
            try { global.otelCounters.hfTokenMisuse.add(1, { modality: 'multimodal' }); } catch(_) {}
          }
          continue; // skip unauthorized asset
        }
        if (stored.type.startsWith('image/') && !imageData) imageData = stored.buffer;
        if (stored.type.startsWith('audio/') && !audioData) audioData = stored.buffer;
      }
    }
    return await OpenTelemetryTracing.traceAgentOperation('MultiModalOracle','bridge.execute',{ 'hf.modality':'multimodal','user.id':userId || 'anonymous' }, async () => {
      let structured = { task: 'multimodal.analysis', status: 'ok', data: {} };
      try {
        if (lower.includes('visual question') || lower.includes('vqa')) {
          structured = { task: 'multimodal.vqa', status: 'ok', data: { answer: 'placeholder', image: !!imageData } };
        } else if (lower.includes('document') && lower.includes('question')) {
          structured = { task: 'multimodal.doc_qa', status: 'ok', data: { answer: 'placeholder' } };
        } else if (lower.includes('analyze') && (lower.includes('image') || lower.includes('audio'))) {
          structured = { task: 'multimodal.cross_modal', status: 'ok', data: { image: !!imageData, audio: !!audioData } };
        } else {
          structured = { task: 'multimodal.generic', status: 'ok', data: { response: this.hfAgent.generateResponse(message) } };
        }
      } catch (e) {
        structured = { task: 'multimodal.error', status: 'error', error: e.message };
      }
      const summary = structured.status === 'error' ? `Multimodal error: ${structured.error}` : `Multimodal ${structured.task} complete.`;
      return {
        messages: [ { type: 'ai', content: summary, structured } ],
        next_agent: 'cartrita',
        meta: { source: 'huggingface', modality: 'multimodal', task: structured.task, status: structured.status }
      };
    });
  }
}

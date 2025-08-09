import AudioWizardAgent from '../agents/AudioWizardAgent.js';
import OpenTelemetryTracing from '../../../system/OpenTelemetryTracing.js';

export default class HFAudioAgent {
  constructor() {
    this.hfAgent = new AudioWizardAgent();
    this.config = {
      name: 'AudioWizard',
      role: 'sub',
      description: 'HuggingFace audio intelligence agent',
      allowedTools: [
        'hf_asr',
        'hf_tts',
        'hf_audio_classification',
        'hf_voice_activity'
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
    let audioBuffer = null;
    const audioMatch = message?.match(/data:audio\/(wav|mpeg|mp3|ogg);base64,([A-Za-z0-9+/=]+)/);
    if (audioMatch) audioBuffer = Buffer.from(audioMatch[2], 'base64');
    const tokenMatch = message?.match(/hfbin:([a-f0-9-]{36})/);
    if (!audioBuffer && tokenMatch && global.hfBinaryStore?.has(tokenMatch[1])) {
      const stored = global.hfBinaryStore.get(tokenMatch[1]);
      if (stored.userId && userId && String(stored.userId) !== String(userId)) {
        console.warn('[HFAudioAgent] Token ownership mismatch');
      } else if (stored.type.startsWith('audio/')) {
        audioBuffer = stored.buffer;
      }
    }
    return await OpenTelemetryTracing.traceAgentOperation('AudioWizard','bridge.execute',{ 'hf.modality':'audio','user.id':userId || 'anonymous' }, async () => {
      let structured = { task: 'audio.analysis', status: 'ok', data: {} };
      try {
        if (lower.includes('transcribe') || lower.includes('speech to text')) {
          const res = await this.hfAgent.transcribeAudio(audioBuffer);
          structured = { task: 'audio.transcription', status: 'ok', data: res };
        } else if (lower.includes('text to speech') || lower.includes('tts')) {
          const res = await this.hfAgent.synthesizeSpeech(message);
          structured = { task: 'audio.tts', status: 'ok', data: res };
        } else if (lower.includes('classify')) {
          const res = await this.hfAgent.classifyAudio(audioBuffer);
          structured = { task: 'audio.classification', status: 'ok', data: res };
        } else if (lower.includes('voice activity')) {
          const res = await this.hfAgent.detectVoiceActivity(audioBuffer);
          structured = { task: 'audio.voice_activity', status: 'ok', data: res };
        } else {
          structured = { task: 'audio.generic', status: 'ok', data: { response: this.hfAgent.generateResponse(message) } };
        }
      } catch (e) {
        structured = { task: 'audio.error', status: 'error', error: e.message };
      }
      const summary = structured.status === 'error' ? `Audio error: ${structured.error}` : `Audio ${structured.task} complete.`;
      return {
        messages: [ { type: 'ai', content: summary, structured } ],
        next_agent: 'cartrita',
        meta: { source: 'huggingface', modality: 'audio', task: structured.task, status: structured.status }
      };
    });
  }
}

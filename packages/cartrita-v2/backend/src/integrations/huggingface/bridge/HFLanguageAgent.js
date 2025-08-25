import LanguageMaestroAgent from '../agents/LanguageMaestroAgent.js';
import OpenTelemetryTracing from '../../../system/OpenTelemetryTracing.js';

export default class HFLanguageAgent {
  constructor() {
    this.hfAgent = new LanguageMaestroAgent();
    this.config = {
      name: 'LanguageMaestro',
      role: 'sub',
      description: 'HuggingFace language intelligence agent',
      allowedTools: [
        'hf_text_generation',
        'hf_text_classification',
        'hf_question_answering',
        'hf_summarization',
        'hf_translation',
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
    // Ownership-enforced hfbin token (language tasks may include reference to uploaded docs)
    const tokenMatches = message?.match(/hfbin:([a-f0-9-]{36})/g) || [];
    for (const token of tokenMatches) {
      const id = token.split(':')[1];
      const stored = global.hfBinaryStore?.get(id);
      if (stored) {
        if (
          stored.userId &&
          userId &&
          String(stored.userId) !== String(userId)
        ) {
          console.warn('[HFLanguageAgent] Token ownership mismatch');
          if (global.otelCounters?.hfTokenMisuse) {
            try {
              global.otelCounters.hfTokenMisuse.add(1, {
                modality: 'language',
              });
            } catch (_) {}
          }
          // We do NOT expose the binary; continue without using it.
        } else {
          // Future: allow document-grounded QA/summarization using stored.buffer/path
        }
      }
    }
    return await OpenTelemetryTracing.traceAgentOperation(
      'LanguageMaestro',
      'bridge.execute',
      { 'hf.modality': 'language', 'user.id': userId || 'anonymous' },
      async () => {
        let structured = { task: 'language.generic', status: 'ok', data: {} };
        try {
          if (lower.includes('summarize')) {
            const res = await this.hfAgent.summarizeText(message);
            structured = {
              task: 'language.summarization',
              status: 'ok',
              data: res,
            };
          } else if (lower.includes('translate')) {
            const res = await this.hfAgent.translateText(message, {
              targetLang: 'en',
            });
            structured = {
              task: 'language.translation',
              status: 'ok',
              data: res,
            };
          } else if (
            lower.includes('classify') ||
            lower.includes('sentiment')
          ) {
            const res = await this.hfAgent.classifyText(message);
            structured = {
              task: 'language.classification',
              status: 'ok',
              data: res,
            };
          } else if (lower.includes('question') && lower.includes('answer')) {
            const res = await this.hfAgent.answerQuestion(message, message);
            structured = { task: 'language.qa', status: 'ok', data: res };
          } else if (lower.includes('generate') || lower.includes('write')) {
            const res = await this.hfAgent.generateText(message);
            structured = {
              task: 'language.generation',
              status: 'ok',
              data: res,
            };
          } else {
            structured = {
              task: 'language.response',
              status: 'ok',
              data: { response: this.hfAgent.generateResponse(message) },
            };
          }
        } catch (e) {
          structured = {
            task: 'language.error',
            status: 'error',
            error: e.message,
          };
        }
        const summary =
          structured.status === 'error'
            ? `Language error: ${structured.error}`
            : `Language ${structured.task} complete.`;
        return {
          messages: [{ type: 'ai', content: summary, structured }],
          next_agent: 'cartrita',
          meta: {
            source: 'huggingface',
            modality: 'language',
            task: structured.task,
            status: structured.status,
          },
        };
      }
    );
  }
}

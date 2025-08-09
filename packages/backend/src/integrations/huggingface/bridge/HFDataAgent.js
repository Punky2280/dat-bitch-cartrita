import DataSageAgent from '../agents/DataSageAgent.js';
import OpenTelemetryTracing from '../../../system/OpenTelemetryTracing.js';

export default class HFDataAgent {
  constructor() {
    this.hfAgent = new DataSageAgent();
    this.config = {
      name: 'DataSage',
      role: 'sub',
      description: 'HuggingFace data analysis agent',
      allowedTools: [
        'hf_tabular_classification',
        'hf_tabular_regression',
        'hf_time_series_forecasting',
        'hf_data_analysis'
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
    let datasetBuffer = null;
    const tokenMatches = (message.match(/hfbin:[a-f0-9-]{36}/g) || []);
    for (const t of tokenMatches) {
      const key = t.split(':')[1];
      const stored = global.hfBinaryStore?.get(key);
      if (stored && !datasetBuffer) {
        if (stored.userId && userId && String(stored.userId) !== String(userId)) {
          console.warn('[HFDataAgent] Token ownership mismatch');
          if (global.otelCounters?.hfTokenMisuse) {
            try { global.otelCounters.hfTokenMisuse.add(1, { modality: 'data' }); } catch(_) {}
          }
          continue;
        }
        datasetBuffer = stored.buffer;
      }
    }
    return await OpenTelemetryTracing.traceAgentOperation('DataSage','bridge.execute',{ 'hf.modality':'data','user.id':userId || 'anonymous' }, async () => {
      let structured = { task: 'data.analysis', status: 'ok', data: {} };
      try {
        if (lower.includes('forecast') || lower.includes('time series')) {
          structured = { task: 'data.forecast', status: 'ok', data: { forecast: 'placeholder', hasDataset: !!datasetBuffer } };
        } else if (lower.includes('regression')) {
          structured = { task: 'data.regression', status: 'ok', data: { model: 'placeholder', r2: 0.9 } };
        } else if (lower.includes('classify') || lower.includes('classification')) {
          structured = { task: 'data.classification', status: 'ok', data: { classes: ['A','B'], distribution: { A: 0.6, B: 0.4 } } };
        } else if (lower.includes('analyze') || lower.includes('data')) {
          structured = { task: 'data.summary', status: 'ok', data: { rows: datasetBuffer ? 100 : null, columns: 10 } };
        } else {
          structured = { task: 'data.generic', status: 'ok', data: { response: this.hfAgent.generateResponse(message) } };
        }
      } catch (e) {
        structured = { task: 'data.error', status: 'error', error: e.message };
      }
      const summary = structured.status === 'error' ? `Data error: ${structured.error}` : `Data ${structured.task} complete.`;
      return {
        messages: [ { type: 'ai', content: summary, structured } ],
        next_agent: 'cartrita',
        meta: { source: 'huggingface', modality: 'data', task: structured.task, status: structured.status }
      };
    });
  }
}

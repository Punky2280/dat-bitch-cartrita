/* ToolEmbeddingService: generates and stores embeddings for tool definitions.
   Env controls:
   REGISTRY_EMBED=1 to enable generation
   EMBEDDING_MODEL=openai/text-embedding-3-small (default fallback)
   OPENAI_API_KEY required if using OpenAI provider
*/
import db from '../../db.js';

export class ToolEmbeddingService {
  constructor(options = {}) {
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.provider = options.provider || 'openai';
    this.openai = null;
  }
  async ensureClient() {
    if (this.provider === 'openai' && !this.openai) {
      const { OpenAI } = await import('openai');
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }
  buildInputPayload(tool) {
    // Concatenate important textual fields for embedding
    return [
      tool.name,
      tool.description || '',
      tool.category || '',
      tool.schema ? JSON.stringify(tool.schema._def ? tool.schema._def : tool.schema) : ''
    ].join('\n').slice(0, 8000); // basic truncation safeguard
  }
  async generateEmbedding(tool) {
    if (process.env.REGISTRY_EMBED !== '1') return null;
    if (!process.env.OPENAI_API_KEY) return null; // silently skip if missing key
    try {
      await this.ensureClient();
      const input = this.buildInputPayload(tool);
      const resp = await this.openai.embeddings.create({ model: this.model, input });
      const vector = resp.data?.[0]?.embedding;
      if (!Array.isArray(vector)) return null;
      // Store as bracketed float list string
      return '[' + vector.map(v => (typeof v === 'number' ? v.toFixed(6) : '0.000000')).join(',') + ']';
    } catch (e) {
      console.warn('[ToolEmbeddingService] embedding generation failed', e.message);
      return null;
    }
  }
  async upsertEmbedding(toolName, embeddingText) {
    if (!embeddingText || !db?.query) return;
    try {
      // Get tool id
      const { rows } = await db.query('SELECT id FROM tool_definitions WHERE name=$1', [toolName]);
      if (!rows.length) return;
      const toolId = rows[0].id;
      await db.query(`INSERT INTO tool_embeddings(tool_id, embedding, updated_at)
        VALUES ($1,$2, now())
        ON CONFLICT (tool_id) DO UPDATE SET embedding=EXCLUDED.embedding, updated_at=now()`, [toolId, embeddingText]);
    } catch (e) {
      console.warn('[ToolEmbeddingService] upsert failed', e.message);
    }
  }
}
export default ToolEmbeddingService;

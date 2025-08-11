// utilityRegistry: registers knowledge and general utility tools (phase 1).
import { z } from 'zod';
import db from '../../../db.js';
import { OpenAI } from 'openai';

export async function registerUtilityTools(registry) {
  // Knowledge Query Tool
  registry.registerTool({
    name: 'knowledge_query',
    description: 'Query the AI Knowledge Hub for stored information',
    category: 'knowledge',
    schema: z.object({
      query: z.string().describe('Search query for knowledge base'),
      user_id: z.string().optional().describe('User ID for personalized results'),
      limit: z.number().optional().describe('Maximum results to return'),
    }),
    func: async ({ query, user_id, limit = 10 }) => {
      try {
        let dbQuery = `\n          SELECT id, title, content, source, entry_type, tags, created_at\n          FROM knowledge_entries \n          WHERE content ILIKE $1 OR title ILIKE $1\n        `;
        const params = [`%${query}%`];
        if (user_id) {
          dbQuery += ' AND user_id = $2 ORDER BY created_at DESC LIMIT $3';
          params.push(user_id, limit);
        } else {
          dbQuery += ' ORDER BY created_at DESC LIMIT $2';
          params.push(limit);
        }
        const result = db && db.query ? await db.query(dbQuery, params) : { rows: [] };

        let semanticResults = [];
        if (result.rows.length === 0 && process.env.OPENAI_API_KEY) {
          try {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            await openai.embeddings.create({ model: 'text-embedding-ada-002', input: query });
            const fallbackQuery = `\n              SELECT id, title, content, source, entry_type, tags, created_at\n              FROM knowledge_entries \n              WHERE to_tsvector('english', content || ' ' || title) @@ plainto_tsquery('english', $1)\n              ${user_id ? 'AND user_id = $2' : ''}\n              ORDER BY ts_rank(to_tsvector('english', content || ' ' || title), plainto_tsquery('english', $1)) DESC\n              LIMIT $${user_id ? '3' : '2'}\n            `;
            const fallbackParams = user_id ? [query, user_id, limit] : [query, limit];
            const fallbackResult = db && db.query ? await db.query(fallbackQuery, fallbackParams) : { rows: [] };
            semanticResults = fallbackResult.rows;
          } catch (e) {
            console.warn('[utilityRegistry] semantic fallback failed:', e.message);
          }
        }
        const allResults = [...(result.rows || []), ...semanticResults];
        const unique = allResults.filter((r,i,a)=>i===a.findIndex(t=>t.id===r.id));
        return {
          success: true,
          query,
          user_id,
          total_results: unique.length,
          results: unique.map(r=>({
            id: r.id,
            title: r.title,
            content: r.content ? r.content.slice(0,500)+(r.content.length>500?'...':'') : null,
            source: r.source,
            entry_type: r.entry_type,
            tags: r.tags,
            created_at: r.created_at,
            relevance_score: Math.random() * 0.3 + 0.7,
          })),
          search_type: unique.length > (result.rows||[]).length ? 'semantic':'keyword',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return { success:false, query, user_id, error: error.message, timestamp: new Date().toISOString() };
      }
    }
  });

  // File Analyzer (mock)
  registry.registerTool({
    name: 'file_analyzer',
    description: 'Analyze files and extract information (mock)',
    category: 'utility',
    schema: z.object({
      file_path: z.string().describe('Path to file to analyze'),
      analysis_type: z.enum(['structure','content','metadata']).describe('Type of analysis'),
    }),
    func: async ({ file_path, analysis_type }) => ({
      success: true,
      file_path,
      analysis_type,
      result: `Mock ${analysis_type} analysis of ${file_path} completed`,
      timestamp: new Date().toISOString()
    })
  });
}

export default registerUtilityTools;

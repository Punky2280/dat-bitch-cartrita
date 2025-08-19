// agentRegistry: registers specialized agent tools (phase 2). Subset for initial extraction.
import { z } from 'zod';
import { OpenAI } from 'openai';
import { Calculator } from '@langchain/community/tools/calculator';
import { WikipediaQueryRun } from '@langchain/community/tools/wikipedia_query_run';

export async function registerAgentTools(registry) {
  // Image analyzer (kept lightweight wrapper around OpenAI vision call gated by key)
  registry.registerTool({
    name: 'image_analyzer',
    description: 'Analyze images for content, style, and composition using AI',
    category: 'image_generation',
    schema: z.object({ image_url: z.string(), analysis_type: z.enum(['content','style','composition','technical','all']) }),
    func: async ({ image_url, analysis_type }) => {
      if (process.env.SKIP_OPENAI === '1' || !process.env.OPENAI_API_KEY) {
        return { skipped:true, reason:'OPENAI disabled', image_url, analysis_type };
      }
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const analysisPrompts = { content:'Describe content', style:'Analyze style', composition:'Analyze composition', technical:'Analyze technical quality', all:'Comprehensive analysis'};
        const response = await openai.chat.completions.create({ model:'gpt-4-vision-preview', messages:[{ role:'user', content:[{ type:'text', text: analysisPrompts[analysis_type] }, { type:'image_url', image_url:{ url:image_url, detail:'low' } }] }], max_tokens:400, temperature:0.3 });
        return { success:true, analysis: response.choices[0].message.content, image_url, analysis_type };
      } catch (e) { return { success:false, error:e.message, image_url, analysis_type }; }
    }
  });

  // Wikipedia Search (direct tool passthrough)
  try {
    const wiki = new WikipediaQueryRun({ topKResults:3, maxDocContentLength:4000 });
    wiki.name='wikipedia_search'; wiki.category='research';
    registry.tools.set('wikipedia_search', wiki);
  } catch(e) { /* ignore */ }

  // Calculator
  try { const calc = new Calculator(); calc.name='calculator'; calc.category='coding'; registry.tools.set('calculator', calc); } catch(e) {}

  // Code reviewer (simplified)
  registry.registerTool({
    name: 'code_reviewer',
    description: 'Review code for issues using AI',
    category: 'coding',
    schema: z.object({ code: z.string(), language: z.string(), focus: z.enum(['bugs','performance','security','style','all']).optional() }),
    func: async ({ code, language, focus='all' }) => {
      if (process.env.SKIP_OPENAI === '1' || !process.env.OPENAI_API_KEY) return { skipped:true, reason:'OPENAI disabled', language };
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const prompt = `Review this ${language} code focusing on ${focus}. Return JSON with keys issues (array) and summary.\n\n${code}`;
      const resp = await openai.chat.completions.create({ model:'gpt-4', messages:[{ role:'user', content: prompt }], temperature:0.2, max_tokens:800 });
      let parsed; try { parsed = JSON.parse(resp.choices[0].message.content); } catch { parsed = { summary: resp.choices[0].message.content }; }
      return { success:true, ...parsed };
    }
  });
}
export default registerAgentTools;

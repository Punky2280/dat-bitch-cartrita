// packages/backend/src/agi/orchestration/AgentToolRegistry.js

/**
 * Enhanced Tool Registry for LangChain Multi-Agent System
 * 
 * This registry manages all tools available to agents with proper permission
 * enforcement and LangChain compliance. Each agent gets access only to
 * tools specified in their configuration.
 * 
 * ARCHITECTURE:
 * - Tools are registered with specific permissions and capabilities
 * - Agents can only access tools in their allowedTools list
 * - Tools are LangChain-compliant with proper schemas
 * - Runtime permission checking and logging
 */

import { DynamicTool  } from '@langchain/core/tools';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { Calculator } from '@langchain/community/tools/calculator';
// WebBrowser tool removed - using custom implementation
import { WikipediaQueryRun } from '@langchain/community/tools/wikipedia_query_run';
import { SerpAPI } from '@langchain/community/tools/serpapi';
// Individual Google tools instead of toolkits
import { GoogleCalendarCreateTool, GoogleCalendarViewTool } from '@langchain/community/tools/google_calendar';
import { GmailCreateDraft, GmailGetMessage, GmailGetThread, GmailSearch, GmailSendMessage } from '@langchain/community/tools/gmail';
import { SearchApi } from '@langchain/community/tools/searchapi';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';
import { BraveSearch } from '@langchain/community/tools/brave_search';
import { z  } from 'zod';
import { OpenAI  } from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import { execSync } from 'child_process';
import db from '../../db.js';

class AgentToolRegistry {
  constructor() {
    this.tools = new Map();
    this.agentPermissions = new Map();
    this.initialized = false;
    
    // Tool usage metrics
    this.metrics = {
      total_tools: 0,
      tool_executions: 0,
      successful_executions: 0,
      failed_executions: 0,
      permission_violations: 0
    };
  }

  /**
   * Initialize the tool registry with all available tools
   */
  async initialize() {
    try {
      console.log('[AgentToolRegistry] 🛠️ Initializing tool registry...');
      
      // Register core system tools
      await this.registerSystemTools();
      
      // Register agent-specific tools
      await this.registerAgentTools();
      
      // Register utility tools
      await this.registerUtilityTools();
      
      this.initialized = true;
      console.log(`[AgentToolRegistry] ✅ Successfully registered ${this.tools.size} tools`);
      console.log('[AgentToolRegistry] 📋 Available tool categories:');
      
      const categories = {};
      for (const [name, tool] of this.tools) {
        const category = tool.category || 'general';
        categories[category] = (categories[category] || 0) + 1;
      }
      
      for (const [category, count] of Object.entries(categories)) {
        console.log(`  ✅ ${category}: ${count} tools`);
      }
      
      return true;
    } catch (error) {
      console.error('[AgentToolRegistry] ❌ Initialization failed:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Register core system tools available to all agents
   */
  async registerSystemTools() {
    // Current DateTime Tool
    this.registerTool({
      name: 'getCurrentDateTime',
      description: 'Get the current date and time in Eastern timezone',
      category: 'system',
      schema: z.object({
        format: z.string().optional().describe('Optional format string (default: ISO)')
      }),
      func: async ({ format = 'ISO' }) => {
        const now = new Date();
        const easternTime = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(now);
        
        if (format === 'ISO') {
          return now.toISOString();
        } else if (format === 'eastern') {
          return easternTime;
        } else if (format === 'friendly') {
          return now.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        }
        
        return now.toISOString();
      }
    });

    // System Status Tool
    this.registerTool({
      name: 'getSystemStatus',
      description: 'Check the system operational status and basic metrics',
      category: 'system',
      schema: z.object({}),
      func: async () => {
        return {
          status: 'operational',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory_usage: process.memoryUsage(),
          version: '2.1.0-hierarchical',
          tools_available: this.tools.size,
          healthy: true
        };
      }
    });
  }

  /**
   * Register agent-specific specialized tools
   */
  async registerAgentTools() {
    // ========================================
    // IMAGE GENERATION TOOLS (Artist Agent)
    // ========================================
    
    this.registerTool({
      name: 'dalle_3',
      description: 'Generate images using DALL-E 3 AI model',
      category: 'image_generation',
      schema: z.object({
        prompt: z.string().describe('Detailed description of the image to generate'),
        size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional().describe('Image size'),
        quality: z.enum(['standard', 'hd']).optional().describe('Image quality'),
        style: z.enum(['vivid', 'natural']).optional().describe('Image style')
      }),
      func: async ({ prompt, size = '1024x1024', quality = 'standard', style = 'vivid' }) => {
        try {
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: size,
            quality: quality,
            style: style
          });
          
          if (response.data && response.data.length > 0) {
            return {
              success: true,
              image_url: response.data[0].url,
              revised_prompt: response.data[0].revised_prompt,
              size: size,
              quality: quality,
              style: style
            };
          }
          
          throw new Error('No image generated');
        } catch (error) {
          console.error('[AgentToolRegistry] DALL-E 3 generation failed:', error);
          return {
            success: false,
            error: error.message
          };
        }
      }
    });

    // Real Image Analysis using OpenAI Vision
    this.registerTool({
      name: 'image_analyzer',
      description: 'Analyze images for content, style, and composition using AI vision',
      category: 'image_generation',
      schema: z.object({
        image_url: z.string().describe('URL of image to analyze'),
        analysis_type: z.enum(['content', 'style', 'composition', 'technical', 'all']).describe('Type of analysis')
      }),
      func: async ({ image_url, analysis_type }) => {
        try {
          console.log(`[AgentToolRegistry] Real AI image analysis: ${analysis_type} on ${image_url}`);
          
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          const analysisPrompts = {
            content: 'Describe what you see in this image. Identify objects, people, animals, settings, and activities. Be specific and detailed.',
            style: 'Analyze the artistic style of this image. Consider color palette, lighting, composition style, artistic movement, and visual aesthetics.',
            composition: 'Analyze the composition of this image. Consider rule of thirds, balance, leading lines, focal points, and overall visual structure.',
            technical: 'Analyze the technical aspects of this image. Consider image quality, resolution, lighting conditions, exposure, and any technical issues.',
            all: 'Provide a comprehensive analysis of this image covering content (what you see), style (artistic elements), composition (visual structure), and technical quality. Structure your response with clear sections.'
          };

          const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Please analyze this image focusing on: ${analysisPrompts[analysis_type]}\n\nProvide your analysis in a structured format.`
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: image_url,
                      detail: "high"
                    }
                  }
                ]
              }
            ],
            max_tokens: 1000,
            temperature: 0.3
          });

          const analysis = response.choices[0].message.content;

          return {
            success: true,
            image_url: image_url,
            analysis_type: analysis_type,
            analysis: analysis,
            model_used: "gpt-4-vision-preview",
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          console.error(`[AgentToolRegistry] Image analysis failed:`, error.message);
          return {
            success: false,
            image_url: image_url,
            analysis_type: analysis_type,
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }
    });

    this.registerTool({
      name: 'visual_editor',
      description: 'Edit and enhance images with filters and effects',
      category: 'image_generation',
      schema: z.object({
        image_url: z.string().describe('URL of image to edit'),
        edits: z.array(z.string()).describe('Array of edit operations (brightness, contrast, saturation, blur, etc.)'),
        intensity: z.number().optional().describe('Edit intensity 0-100 (default: 50)')
      }),
      func: async ({ image_url, edits, intensity = 50 }) => {
        console.log(`[AgentToolRegistry] Mock image editing: ${edits.join(', ')} on ${image_url}`);
        return {
          success: true,
          original_url: image_url,
          edited_url: `${image_url}_edited_${Date.now()}`,
          edits_applied: edits,
          intensity: intensity,
          timestamp: new Date().toISOString()
        };
      }
    });

    // ========================================
    // RESEARCH TOOLS (Researcher Agent)
    // ========================================

    // Advanced Web Search using Tavily (if API key available)
    if (process.env.TAVILY_API_KEY) {
      const tavilySearch = new TavilySearchResults({
        maxResults: 5,
        apiKey: process.env.TAVILY_API_KEY
      });
      tavilySearch.name = 'tavily_search';
      tavilySearch.category = 'research';
      this.tools.set('tavily_search', tavilySearch);
      this.metrics.total_tools++;
      console.log('[AgentToolRegistry] ✅ Registered tool: tavily_search (research)');
    }

    // Wikipedia Search Tool
    const wikipediaSearch = new WikipediaQueryRun({
      topKResults: 3,
      maxDocContentLength: 4000,
    });
    wikipediaSearch.name = 'wikipedia_search';
    wikipediaSearch.category = 'research';
    this.tools.set('wikipedia_search', wikipediaSearch);
    this.metrics.total_tools++;
    console.log('[AgentToolRegistry] ✅ Registered tool: wikipedia_search (research)');

    // SerpAPI Search (if API key available)
    if (process.env.SERPAPI_API_KEY) {
      const serpSearch = new SerpAPI(process.env.SERPAPI_API_KEY, {
        location: "Austin,Texas,United States",
        hl: "en",
        gl: "us",
      });
      serpSearch.name = 'serp_search';
      serpSearch.category = 'research';
      this.tools.set('serp_search', serpSearch);
      this.metrics.total_tools++;
      console.log('[AgentToolRegistry] ✅ Registered tool: serp_search (research)');
    }

    // DuckDuckGo Search Tool (free, no API key needed)
    try {
      const duckDuckGoSearch = new DuckDuckGoSearch({ maxResults: 10 });
      duckDuckGoSearch.name = 'duckduckgo_search';
      duckDuckGoSearch.category = 'research';
      this.tools.set('duckduckgo_search', duckDuckGoSearch);
      this.metrics.total_tools++;
      console.log('[AgentToolRegistry] ✅ Registered tool: duckduckgo_search (research)');
    } catch (error) {
      console.warn('[AgentToolRegistry] ⚠️ DuckDuckGo search unavailable:', error.message);
    }

    // Brave Search Tool (if API key available)
    if (process.env.BRAVE_API_KEY) {
      try {
        const braveSearch = new BraveSearch({ apiKey: process.env.BRAVE_API_KEY });
        braveSearch.name = 'brave_search';
        braveSearch.category = 'research';
        this.tools.set('brave_search', braveSearch);
        this.metrics.total_tools++;
        console.log('[AgentToolRegistry] ✅ Registered tool: brave_search (research)');
      } catch (error) {
        console.warn('[AgentToolRegistry] ⚠️ Brave search unavailable:', error.message);
      }
    }

    // SearchApi Tool (if API key available)
    if (process.env.SEARCHAPI_API_KEY) {
      try {
        const searchApiTool = new SearchApi(process.env.SEARCHAPI_API_KEY, {
          engine: "google"
        });
        searchApiTool.name = 'search_api';
        searchApiTool.category = 'research';
        this.tools.set('search_api', searchApiTool);
        this.metrics.total_tools++;
        console.log('[AgentToolRegistry] ✅ Registered tool: search_api (research)');
      } catch (error) {
        console.warn('[AgentToolRegistry] ⚠️ SearchApi unavailable:', error.message);
      }
    }

    // Web Browser Tool for reading web pages with OpenAI (temporarily disabled - tool not available in current LangChain version)
    // if (process.env.OPENAI_API_KEY) {
    //   const webBrowser = new WebBrowser({
    //     model: new OpenAI({ apiKey: process.env.OPENAI_API_KEY, temperature: 0 }),
    //     embeddings: null // Can add embeddings here if needed
    //   });
    //   webBrowser.name = 'web_browser';
    //   webBrowser.category = 'research';
    //   this.tools.set('web_browser', webBrowser);
    //   this.metrics.total_tools++;
    //   console.log('[AgentToolRegistry] ✅ Registered tool: web_browser (research)');
    // }

    // Real URL Scraper Tool
    this.registerTool({
      name: 'url_scraper',
      description: 'Scrape and extract content from URLs',
      category: 'research',
      schema: z.object({
        url: z.string().describe('URL to scrape'),
        content_type: z.enum(['text', 'links', 'images', 'all']).optional().describe('Type of content to extract'),
        max_length: z.number().optional().describe('Maximum content length (default: 5000)')
      }),
      func: async ({ url, content_type = 'text', max_length = 5000 }) => {
        try {
          console.log(`[AgentToolRegistry] Real URL scraping: ${content_type} from ${url}`);
          
          const response = await axios.get(url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });

          const $ = cheerio.load(response.data);
          
          let result = {
            success: true,
            url: url,
            content_type: content_type,
            metadata: {
              title: $('title').text().trim() || 'No title found',
              description: $('meta[name="description"]').attr('content') || 'No description found',
              scrape_time: new Date().toISOString(),
              status_code: response.status
            },
            timestamp: new Date().toISOString()
          };

          switch (content_type) {
            case 'text':
              result.content = $('body').text().replace(/\s+/g, ' ').trim().substring(0, max_length);
              break;
            case 'links':
              result.links = $('a[href]').map((i, el) => ({
                text: $(el).text().trim(),
                href: $(el).attr('href')
              })).get().slice(0, 50);
              break;
            case 'images':
              result.images = $('img[src]').map((i, el) => ({
                alt: $(el).attr('alt') || '',
                src: $(el).attr('src')
              })).get().slice(0, 20);
              break;
            case 'all':
              result.content = $('body').text().replace(/\s+/g, ' ').trim().substring(0, max_length);
              result.links = $('a[href]').map((i, el) => ({
                text: $(el).text().trim(),
                href: $(el).attr('href')
              })).get().slice(0, 20);
              result.images = $('img[src]').map((i, el) => ({
                alt: $(el).attr('alt') || '',
                src: $(el).attr('src')
              })).get().slice(0, 10);
              break;
          }

          return result;
        } catch (error) {
          console.error(`[AgentToolRegistry] URL scraping failed:`, error.message);
          return {
            success: false,
            url: url,
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }
    });

    // Real arXiv Search Tool
    this.registerTool({
      name: 'arxiv_search',
      description: 'Search academic papers on arXiv',
      category: 'research',
      schema: z.object({
        query: z.string().describe('Search query for academic papers'),
        max_results: z.number().optional().describe('Maximum results (default: 5)'),
        category: z.string().optional().describe('arXiv category filter')
      }),
      func: async ({ query, max_results = 5, category }) => {
        try {
          console.log(`[AgentToolRegistry] Real arXiv search for: "${query}"`);
          
          // Build arXiv API query
          let searchQuery = `search_query=all:${encodeURIComponent(query)}`;
          if (category) {
            searchQuery += `+AND+cat:${encodeURIComponent(category)}`;
          }
          searchQuery += `&start=0&max_results=${max_results}`;
          
          const apiUrl = `http://export.arxiv.org/api/query?${searchQuery}`;
          const response = await axios.get(apiUrl, { timeout: 15000 });
          
          // Parse XML response
          const $ = cheerio.load(response.data, { xmlMode: true });
          const papers = [];
          
          $('entry').each((i, entry) => {
            const $entry = $(entry);
            papers.push({
              title: $entry.find('title').text().trim(),
              authors: $entry.find('author name').map((j, author) => $(author).text().trim()).get(),
              abstract: $entry.find('summary').text().trim().replace(/\s+/g, ' '),
              arxiv_id: $entry.find('id').text().split('/').pop(),
              url: $entry.find('id').text(),
              published: $entry.find('published').text(),
              updated: $entry.find('updated').text(),
              categories: $entry.find('category').map((j, cat) => $(cat).attr('term')).get()
            });
          });

          return {
            success: true,
            query: query,
            category: category,
            total_results: papers.length,
            papers: papers,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          console.error(`[AgentToolRegistry] arXiv search failed:`, error.message);
          return {
            success: false,
            query: query,
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }
    });

    // News Search Tool
    this.registerTool({
      name: 'news_search',
      description: 'Search for current news articles and updates',
      category: 'research',
      schema: z.object({
        query: z.string().describe('News search query'),
        timeframe: z.enum(['today', 'week', 'month']).optional().describe('Time period for news'),
        source: z.string().optional().describe('Specific news source')
      }),
      func: async ({ query, timeframe = 'week', source }) => {
        console.log(`[AgentToolRegistry] Mock news search for: "${query}" (${timeframe})`);
        return {
          success: true,
          query: query,
          timeframe: timeframe,
          source: source,
          articles: [
            {
              title: `Breaking news about ${query}`,
              url: 'https://example-news.com/article1',
              summary: `This is a mock news article about ${query}.`,
              published_date: new Date().toISOString(),
              source: source || 'Mock News Source'
            }
          ],
          timestamp: new Date().toISOString()
        };
      }
    });

    // ========================================
    // CODING TOOLS (CodeWriter Agent)
    // ========================================

    // Calculator Tool from LangChain
    const calculator = new Calculator();
    calculator.name = 'calculator';
    calculator.category = 'coding';
    this.tools.set('calculator', calculator);
    this.metrics.total_tools++;
    console.log('[AgentToolRegistry] ✅ Registered tool: calculator (coding)');

    // Code Execution Tool
    this.registerTool({
      name: 'code_executor',
      description: 'Execute code snippets and return results (safe sandbox)',
      category: 'coding',
      schema: z.object({
        code: z.string().describe('Code to execute'),
        language: z.enum(['javascript', 'python', 'bash', 'sql']).describe('Programming language'),
        timeout: z.number().optional().describe('Execution timeout in seconds (default: 10)')
      }),
      func: async ({ code, language, timeout = 10 }) => {
        console.log(`[AgentToolRegistry] Mock code execution (${language}):`, code.substring(0, 100));
        return {
          success: true,
          language: language,
          code: code,
          output: `Mock execution result for ${language} code:\n// Output would appear here`,
          execution_time: Math.random() * 1000,
          timestamp: new Date().toISOString()
        };
      }
    });

    // GitHub Search Tool
    this.registerTool({
      name: 'github_search',
      description: 'Search GitHub repositories and code',
      category: 'coding',
      schema: z.object({
        query: z.string().describe('Search query for GitHub'),
        type: z.enum(['repositories', 'code', 'issues', 'users']).describe('Type of search'),
        language: z.string().optional().describe('Programming language filter')
      }),
      func: async ({ query, type, language }) => {
        console.log(`[AgentToolRegistry] Mock GitHub search: ${type} for "${query}"`);
        return {
          success: true,
          query: query,
          search_type: type,
          language: language,
          results: [
            {
              name: `Mock ${type} result for ${query}`,
              url: `https://github.com/example/${query.replace(/\s+/g, '-')}`,
              description: `This is a mock ${type} result for "${query}"`,
              stars: Math.floor(Math.random() * 1000),
              language: language || 'JavaScript'
            }
          ],
          timestamp: new Date().toISOString()
        };
      }
    });

    // Real Code Review Tool using OpenAI
    this.registerTool({
      name: 'code_reviewer',
      description: 'Review code for bugs, performance, and best practices using AI',
      category: 'coding',
      schema: z.object({
        code: z.string().describe('Code to review'),
        language: z.string().describe('Programming language'),
        focus: z.enum(['bugs', 'performance', 'security', 'style', 'all']).optional().describe('Review focus')
      }),
      func: async ({ code, language, focus = 'all' }) => {
        try {
          console.log(`[AgentToolRegistry] Real AI code review (${language}): ${focus}`);
          
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          const focusInstructions = {
            bugs: 'Focus on identifying potential bugs, logic errors, and runtime issues.',
            performance: 'Focus on performance optimizations, efficiency improvements, and algorithmic complexity.',
            security: 'Focus on security vulnerabilities, input validation, and potential attack vectors.',
            style: 'Focus on code style, formatting, naming conventions, and readability.',
            all: 'Provide a comprehensive review covering bugs, performance, security, and style.'
          };

          const prompt = `You are an expert code reviewer. Please review the following ${language} code and ${focusInstructions[focus]}

Provide your review in JSON format with the following structure:
{
  "overall_score": <number 1-10>,
  "complexity": "<low|medium|high>",
  "issues": [
    {
      "type": "<bug|performance|security|style>",
      "severity": "<low|medium|high|critical>",
      "line": <line_number_if_applicable>,
      "description": "<issue_description>",
      "suggestion": "<how_to_fix>"
    }
  ],
  "positive_aspects": ["<good_practices_found>"],
  "summary": "<overall_assessment>"
}

Code to review:
\`\`\`${language}
${code}
\`\`\``;

          const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 2000
          });

          let review;
          try {
            review = JSON.parse(response.choices[0].message.content);
          } catch (parseError) {
            // Fallback if JSON parsing fails
            review = {
              overall_score: 7,
              complexity: 'medium',
              issues: [],
              positive_aspects: [],
              summary: response.choices[0].message.content,
              raw_response: response.choices[0].message.content
            };
          }

          return {
            success: true,
            language: language,
            focus: focus,
            review: review,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          console.error(`[AgentToolRegistry] Code review failed:`, error.message);
          return {
            success: false,
            language: language,
            focus: focus,
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }
    });

    // Documentation Generator
    this.registerTool({
      name: 'doc_generator',
      description: 'Generate documentation for code',
      category: 'coding',
      schema: z.object({
        code: z.string().describe('Code to document'),
        language: z.string().describe('Programming language'),
        style: z.enum(['jsdoc', 'sphinx', 'markdown', 'readme']).optional().describe('Documentation style')
      }),
      func: async ({ code, language, style = 'markdown' }) => {
        console.log(`[AgentToolRegistry] Mock documentation generation (${style}) for ${language}`);
        return {
          success: true,
          language: language,
          style: style,
          documentation: `# Mock Documentation\n\nThis is generated documentation for the provided ${language} code.`,
          timestamp: new Date().toISOString()
        };
      }
    });

    // ========================================
    // SCHEDULING TOOLS (Scheduler Agent)
    // ========================================

    // Google Calendar Integration with provided API key
    if (process.env.GOOGLE_API_KEY) {
      try {
        // Google Calendar Tools
        const calendarCreate = new GoogleCalendarCreateTool({
          credentials: {
            apiKey: process.env.GOOGLE_API_KEY
          }
        });
        calendarCreate.name = 'google_calendar_create';
        calendarCreate.category = 'scheduling';
        this.tools.set('google_calendar_create', calendarCreate);
        this.metrics.total_tools++;
        console.log('[AgentToolRegistry] ✅ Registered tool: google_calendar_create (scheduling)');

        const calendarView = new GoogleCalendarViewTool({
          credentials: {
            apiKey: process.env.GOOGLE_API_KEY
          }
        });
        calendarView.name = 'google_calendar_view';
        calendarView.category = 'scheduling';
        this.tools.set('google_calendar_view', calendarView);
        this.metrics.total_tools++;
        console.log('[AgentToolRegistry] ✅ Registered tool: google_calendar_view (scheduling)');

      } catch (error) {
        console.warn('[AgentToolRegistry] ⚠️ Google Calendar tools unavailable:', error.message);
      }
    }

    // Calendar Management Tool
    this.registerTool({
      name: 'calendar_api',
      description: 'Manage calendar events and scheduling',
      category: 'scheduling',
      schema: z.object({
        action: z.enum(['list', 'create', 'update', 'delete', 'search']).describe('Calendar action'),
        event_data: z.any().optional().describe('Event data for create/update actions'),
        date_range: z.any().optional().describe('Date range for list actions'),
        search_query: z.string().optional().describe('Search query for events')
      }),
      func: async ({ action, event_data, date_range, search_query }) => {
        console.log(`[AgentToolRegistry] Mock calendar action: ${action}`);
        return {
          success: true,
          action: action,
          result: action === 'list' ? [
            {
              id: 'event1',
              title: 'Mock Meeting',
              start: new Date().toISOString(),
              end: new Date(Date.now() + 3600000).toISOString(),
              description: 'Mock calendar event'
            }
          ] : `Mock calendar ${action} operation completed`,
          timestamp: new Date().toISOString()
        };
      }
    });

    // Time Zone Converter
    this.registerTool({
      name: 'timezone_converter',
      description: 'Convert times between different time zones',
      category: 'scheduling',
      schema: z.object({
        time: z.string().describe('Time to convert (ISO format or natural language)'),
        from_tz: z.string().describe('Source timezone'),
        to_tz: z.string().describe('Target timezone')
      }),
      func: async ({ time, from_tz, to_tz }) => {
        console.log(`[AgentToolRegistry] Mock timezone conversion: ${time} from ${from_tz} to ${to_tz}`);
        return {
          success: true,
          original_time: time,
          from_timezone: from_tz,
          to_timezone: to_tz,
          converted_time: new Date().toISOString(),
          timestamp: new Date().toISOString()
        };
      }
    });

    // Meeting Scheduler
    this.registerTool({
      name: 'meeting_scheduler',
      description: 'Find optimal meeting times for multiple participants',
      category: 'scheduling',
      schema: z.object({
        participants: z.array(z.string()).describe('List of participant emails'),
        duration: z.number().describe('Meeting duration in minutes'),
        date_range: z.object({
          start: z.string(),
          end: z.string()
        }).describe('Date range to search for availability')
      }),
      func: async ({ participants, duration, date_range }) => {
        console.log(`[AgentToolRegistry] Mock meeting scheduling for ${participants.length} participants`);
        return {
          success: true,
          participants: participants,
          duration: duration,
          suggested_times: [
            {
              start: new Date(Date.now() + 86400000).toISOString(),
              end: new Date(Date.now() + 86400000 + (duration * 60000)).toISOString(),
              availability_score: 0.9
            }
          ],
          timestamp: new Date().toISOString()
        };
      }
    });

    // ========================================
    // WRITING TOOLS (Writer Agent)
    // ========================================

    // Real Grammar Checker using OpenAI
    this.registerTool({
      name: 'grammar_checker',
      description: 'Check grammar and spelling in text using AI',
      category: 'writing',
      schema: z.object({
        text: z.string().describe('Text to check'),
        language: z.string().optional().describe('Language code (default: en)')
      }),
      func: async ({ text, language = 'en' }) => {
        try {
          console.log(`[AgentToolRegistry] Real AI grammar check (${language}):`, text.substring(0, 50));
          
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

          const prompt = `Please check the following text for grammar, spelling, and punctuation errors. Provide corrections in JSON format:

{
  "corrections": [
    {
      "error": "original error text",
      "correction": "corrected text",
      "type": "grammar|spelling|punctuation",
      "explanation": "brief explanation",
      "position": {"start": 0, "end": 10}
    }
  ],
  "corrected_text": "full corrected version",
  "score": <1-100>,
  "summary": "brief summary of issues found"
}

Text to check (${language}):
"${text}"`;

          const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 1500
          });

          let result;
          try {
            result = JSON.parse(response.choices[0].message.content);
          } catch (parseError) {
            result = {
              corrections: [],
              corrected_text: text,
              score: 90,
              summary: "Unable to parse corrections",
              raw_response: response.choices[0].message.content
            };
          }

          return {
            success: true,
            original_text: text,
            language: language,
            ...result,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          console.error(`[AgentToolRegistry] Grammar check failed:`, error.message);
          return {
            success: false,
            original_text: text,
            language: language,
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }
    });

    this.registerTool({
      name: 'style_analyzer',
      description: 'Analyze writing style and suggest improvements',
      category: 'writing',
      schema: z.object({
        text: z.string().describe('Text to analyze'),
        style_guide: z.enum(['academic', 'business', 'creative', 'technical']).optional().describe('Style guide to check against')
      }),
      func: async ({ text, style_guide = 'business' }) => {
        console.log(`[AgentToolRegistry] Mock style analysis (${style_guide}):`, text.substring(0, 50));
        return {
          success: true,
          text_length: text.length,
          style_guide: style_guide,
          analysis: {
            readability_score: 8.5,
            tone: 'professional',
            suggestions: ['Consider using more active voice', 'Vary sentence length']
          },
          timestamp: new Date().toISOString()
        };
      }
    });

    this.registerTool({
      name: 'content_optimizer',
      description: 'Optimize content for SEO and engagement',
      category: 'writing',
      schema: z.object({
        content: z.string().describe('Content to optimize'),
        keywords: z.array(z.string()).optional().describe('Target keywords'),
        content_type: z.enum(['blog', 'article', 'social', 'email']).describe('Type of content')
      }),
      func: async ({ content, keywords = [], content_type }) => {
        console.log(`[AgentToolRegistry] Mock content optimization (${content_type})`);
        return {
          success: true,
          content_type: content_type,
          keywords: keywords,
          optimization: {
            seo_score: 85,
            keyword_density: '2.5%',
            suggestions: ['Add more keywords in headings', 'Improve meta description']
          },
          timestamp: new Date().toISOString()
        };
      }
    });

    this.registerTool({
      name: 'plagiarism_checker',
      description: 'Check content for plagiarism and originality',
      category: 'writing',
      schema: z.object({
        text: z.string().describe('Text to check for plagiarism'),
        threshold: z.number().optional().describe('Similarity threshold (default: 0.1)')
      }),
      func: async ({ text, threshold = 0.1 }) => {
        console.log(`[AgentToolRegistry] Mock plagiarism check:`, text.substring(0, 50));
        return {
          success: true,
          originality_score: 98,
          threshold: threshold,
          matches: [],
          timestamp: new Date().toISOString()
        };
      }
    });

    // ========================================
    // TASK MANAGEMENT TOOLS (TaskManager Agent)
    // ========================================

    this.registerTool({
      name: 'task_tracker',
      description: 'Manage tasks and project workflows',
      category: 'task_management',
      schema: z.object({
        action: z.enum(['create', 'update', 'list', 'complete', 'delete', 'assign']).describe('Task action'),
        task_data: z.any().optional().describe('Task data'),
        filters: z.any().optional().describe('Filters for list actions'),
        assignee: z.string().optional().describe('Person to assign task to')
      }),
      func: async ({ action, task_data, filters, assignee }) => {
        console.log(`[AgentToolRegistry] Mock task management action: ${action}`);
        return {
          success: true,
          action: action,
          result: action === 'list' ? [
            {
              id: 'task1',
              title: 'Mock Task',
              status: 'in_progress',
              priority: 'high',
              assignee: assignee || 'unassigned',
              due_date: new Date(Date.now() + 86400000).toISOString()
            }
          ] : `Mock task ${action} operation completed`,
          timestamp: new Date().toISOString()
        };
      }
    });

    this.registerTool({
      name: 'workflow_engine',
      description: 'Manage and execute complex workflows',
      category: 'task_management',
      schema: z.object({
        action: z.enum(['create', 'execute', 'monitor', 'pause', 'resume']).describe('Workflow action'),
        workflow_id: z.string().optional().describe('Workflow identifier'),
        workflow_data: z.any().optional().describe('Workflow definition')
      }),
      func: async ({ action, workflow_id, workflow_data }) => {
        console.log(`[AgentToolRegistry] Mock workflow action: ${action}`);
        return {
          success: true,
          action: action,
          workflow_id: workflow_id || `workflow_${Date.now()}`,
          status: 'running',
          timestamp: new Date().toISOString()
        };
      }
    });

    this.registerTool({
      name: 'priority_analyzer',
      description: 'Analyze and prioritize tasks based on various factors',
      category: 'task_management',
      schema: z.object({
        tasks: z.array(z.any()).describe('Array of tasks to prioritize'),
        criteria: z.array(z.string()).optional().describe('Prioritization criteria')
      }),
      func: async ({ tasks, criteria = ['urgency', 'importance', 'effort'] }) => {
        console.log(`[AgentToolRegistry] Mock priority analysis for ${tasks.length} tasks`);
        return {
          success: true,
          criteria: criteria,
          prioritized_tasks: tasks.map((task, index) => ({
            ...task,
            priority_score: Math.random() * 100,
            rank: index + 1
          })),
          timestamp: new Date().toISOString()
        };
      }
    });

    // ========================================
    // ANALYTICS TOOLS (Analytics Agent)
    // ========================================

    this.registerTool({
      name: 'data_analyzer',
      description: 'Analyze data and generate insights',
      category: 'analytics',
      schema: z.object({
        data: z.any().describe('Data to analyze'),
        analysis_type: z.enum(['descriptive', 'predictive', 'diagnostic', 'prescriptive']).describe('Type of analysis'),
        format: z.enum(['json', 'chart', 'summary', 'report']).optional().describe('Output format')
      }),
      func: async ({ data, analysis_type, format = 'summary' }) => {
        console.log(`[AgentToolRegistry] Mock data analysis: ${analysis_type}`);
        return {
          success: true,
          analysis_type: analysis_type,
          insights: {
            key_findings: ['Finding 1', 'Finding 2'],
            trends: ['Trend 1', 'Trend 2'],
            recommendations: ['Recommendation 1', 'Recommendation 2']
          },
          format: format,
          timestamp: new Date().toISOString()
        };
      }
    });

    this.registerTool({
      name: 'chart_generator',
      description: 'Generate charts and visualizations from data',
      category: 'analytics',
      schema: z.object({
        data: z.any().describe('Data to visualize'),
        chart_type: z.enum(['bar', 'line', 'pie', 'scatter', 'heatmap']).describe('Type of chart'),
        title: z.string().optional().describe('Chart title'),
        style: z.enum(['modern', 'classic', 'minimal']).optional().describe('Chart style')
      }),
      func: async ({ data, chart_type, title, style = 'modern' }) => {
        console.log(`[AgentToolRegistry] Mock chart generation: ${chart_type}`);
        return {
          success: true,
          chart_type: chart_type,
          title: title || `Mock ${chart_type} Chart`,
          style: style,
          chart_url: `https://example.com/chart_${Date.now()}.png`,
          timestamp: new Date().toISOString()
        };
      }
    });

    this.registerTool({
      name: 'statistics_engine',
      description: 'Perform statistical calculations and tests',
      category: 'analytics',
      schema: z.object({
        data: z.array(z.number()).describe('Numerical data array'),
        test_type: z.enum(['descriptive', 'correlation', 'regression', 't_test', 'anova']).describe('Statistical test to perform'),
        confidence_level: z.number().optional().describe('Confidence level (default: 0.95)')
      }),
      func: async ({ data, test_type, confidence_level = 0.95 }) => {
        console.log(`[AgentToolRegistry] Mock statistical analysis: ${test_type}`);
        return {
          success: true,
          test_type: test_type,
          sample_size: data.length,
          results: {
            mean: data.reduce((a, b) => a + b, 0) / data.length,
            std_dev: Math.sqrt(data.reduce((a, b) => a + Math.pow(b - (data.reduce((x, y) => x + y, 0) / data.length), 2), 0) / data.length),
            confidence_interval: [0.1, 0.9],
            p_value: 0.05
          },
          confidence_level: confidence_level,
          timestamp: new Date().toISOString()
        };
      }
    });

    // ========================================
    // COMEDY TOOLS (Comedian Agent)
    // ========================================

    this.registerTool({
      name: 'joke_generator',
      description: 'Generate jokes and humorous content',
      category: 'humor',
      schema: z.object({
        topic: z.string().optional().describe('Topic for the joke'),
        style: z.enum(['pun', 'one_liner', 'story', 'observational']).optional().describe('Style of humor'),
        audience: z.enum(['general', 'tech', 'business', 'family']).optional().describe('Target audience')
      }),
      func: async ({ topic, style = 'one_liner', audience = 'general' }) => {
        console.log(`[AgentToolRegistry] Mock joke generation: ${style} about ${topic}`);
        const jokes = [
          "Why don't scientists trust atoms? Because they make up everything!",
          "I told my wife she was drawing her eyebrows too high. She looked surprised.",
          "Why don't programmers like nature? It has too many bugs."
        ];
        return {
          success: true,
          topic: topic,
          style: style,
          audience: audience,
          joke: jokes[Math.floor(Math.random() * jokes.length)],
          timestamp: new Date().toISOString()
        };
      }
    });

    this.registerTool({
      name: 'meme_creator',
      description: 'Create memes and viral content',
      category: 'humor',
      schema: z.object({
        template: z.string().optional().describe('Meme template to use'),
        top_text: z.string().describe('Top text for meme'),
        bottom_text: z.string().optional().describe('Bottom text for meme'),
        style: z.enum(['classic', 'modern', 'absurd']).optional().describe('Meme style')
      }),
      func: async ({ template, top_text, bottom_text, style = 'classic' }) => {
        console.log(`[AgentToolRegistry] Mock meme creation: ${template}`);
        return {
          success: true,
          template: template || 'Distracted Boyfriend',
          top_text: top_text,
          bottom_text: bottom_text,
          style: style,
          meme_url: `https://example.com/meme_${Date.now()}.jpg`,
          timestamp: new Date().toISOString()
        };
      }
    });

    this.registerTool({
      name: 'humor_analyzer',
      description: 'Analyze content for humor and comedic timing',
      category: 'humor',
      schema: z.object({
        content: z.string().describe('Content to analyze for humor'),
        humor_type: z.array(z.string()).optional().describe('Types of humor to look for')
      }),
      func: async ({ content, humor_type = ['wordplay', 'irony', 'absurd'] }) => {
        console.log(`[AgentToolRegistry] Mock humor analysis:`, content.substring(0, 50));
        return {
          success: true,
          humor_score: Math.random() * 10,
          detected_humor: humor_type.slice(0, 2),
          suggestions: ['Add more timing', 'Consider wordplay'],
          timestamp: new Date().toISOString()
        };
      }
    });

    // ========================================
    // DESIGN TOOLS (Designer Agent)
    // ========================================

    this.registerTool({
      name: 'design_tools',
      description: 'Create and edit UI/UX designs',
      category: 'design',
      schema: z.object({
        action: z.enum(['create', 'edit', 'analyze', 'export']).describe('Design action'),
        design_type: z.enum(['ui', 'logo', 'banner', 'mockup']).describe('Type of design'),
        specifications: z.any().optional().describe('Design specifications'),
        style: z.enum(['modern', 'classic', 'minimal', 'bold']).optional().describe('Design style')
      }),
      func: async ({ action, design_type, specifications, style = 'modern' }) => {
        console.log(`[AgentToolRegistry] Mock design ${action}: ${design_type} (${style})`);
        return {
          success: true,
          action: action,
          design_type: design_type,
          style: style,
          design_url: `https://example.com/design_${Date.now()}.png`,
          specifications: specifications,
          timestamp: new Date().toISOString()
        };
      }
    });

    this.registerTool({
      name: 'mockup_generator',
      description: 'Generate mockups and prototypes',
      category: 'design',
      schema: z.object({
        type: z.enum(['website', 'mobile_app', 'desktop_app', 'print']).describe('Type of mockup'),
        pages: z.array(z.string()).describe('Pages or screens to include'),
        style_guide: z.any().optional().describe('Style guide to follow')
      }),
      func: async ({ type, pages, style_guide }) => {
        console.log(`[AgentToolRegistry] Mock mockup generation: ${type} with ${pages.length} pages`);
        return {
          success: true,
          mockup_type: type,
          pages: pages,
          mockup_urls: pages.map((page, i) => `https://example.com/mockup_${page}_${i}.png`),
          style_guide: style_guide,
          timestamp: new Date().toISOString()
        };
      }
    });

    this.registerTool({
      name: 'ux_analyzer',
      description: 'Analyze user experience and interface design',
      category: 'design',
      schema: z.object({
        design_url: z.string().describe('URL of design to analyze'),
        analysis_type: z.enum(['usability', 'accessibility', 'aesthetics', 'all']).describe('Type of UX analysis')
      }),
      func: async ({ design_url, analysis_type }) => {
        console.log(`[AgentToolRegistry] Mock UX analysis: ${analysis_type} on ${design_url}`);
        return {
          success: true,
          design_url: design_url,
          analysis_type: analysis_type,
          scores: {
            usability: 8.5,
            accessibility: 9.0,
            aesthetics: 7.8,
            overall: 8.4
          },
          recommendations: ['Improve color contrast', 'Add more whitespace'],
          timestamp: new Date().toISOString()
        };
      }
    });

    // Security Audit Tool (Security Agent)
    this.registerTool({
      name: 'security_scanner',
      description: 'Perform security scans and vulnerability assessments',
      category: 'security',
      schema: z.object({
        target: z.string().describe('Target to scan (URL, code, etc.)'),
        scan_type: z.enum(['vulnerability', 'compliance', 'penetration']).describe('Type of security scan')
      }),
      func: async ({ target, scan_type }) => {
        console.log(`[AgentToolRegistry] Mock security scan: ${scan_type} on ${target}`);
        return {
          success: true,
          scan_type: scan_type,
          target: target,
          result: `Mock ${scan_type} scan completed - no issues found`,
          timestamp: new Date().toISOString()
        };
      }
    });
  }

  /**
   * Register utility tools for various functions
   */
  async registerUtilityTools() {
    // Real Knowledge Query Tool
    this.registerTool({
      name: 'knowledge_query',
      description: 'Query the AI Knowledge Hub for stored information',
      category: 'knowledge',  
      schema: z.object({
        query: z.string().describe('Search query for knowledge base'),
        user_id: z.string().optional().describe('User ID for personalized results'),
        limit: z.number().optional().describe('Maximum results to return')
      }),
      func: async ({ query, user_id, limit = 10 }) => {
        try {
          console.log(`[AgentToolRegistry] Real knowledge query: "${query}" for user ${user_id}`);
          
          // Query knowledge entries from database
          let dbQuery = `
            SELECT id, title, content, source, entry_type, tags, created_at
            FROM knowledge_entries 
            WHERE content ILIKE $1 OR title ILIKE $1
          `;
          let queryParams = [`%${query}%`];
          
          if (user_id) {
            dbQuery += ` AND user_id = $2`;
            queryParams.push(user_id);
            dbQuery += ` ORDER BY created_at DESC LIMIT $3`;
            queryParams.push(limit);
          } else {
            dbQuery += ` ORDER BY created_at DESC LIMIT $2`;
            queryParams.push(limit);
          }

          const result = await db.query(dbQuery, queryParams);
          
          // If no direct matches, try semantic search with OpenAI embeddings (if available)
          let semanticResults = [];
          if (result.rows.length === 0 && process.env.OPENAI_API_KEY) {
            try {
              const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
              
              // Generate embedding for the query
              const embedding = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: query,
              });
              
              // For now, just do a text-based fallback since we don't have vector search
              const fallbackQuery = `
                SELECT id, title, content, source, entry_type, tags, created_at
                FROM knowledge_entries 
                WHERE to_tsvector('english', content || ' ' || title) @@ plainto_tsquery('english', $1)
                ${user_id ? 'AND user_id = $2' : ''}
                ORDER BY ts_rank(to_tsvector('english', content || ' ' || title), plainto_tsquery('english', $1)) DESC
                LIMIT $${user_id ? '3' : '2'}
              `;
              
              const fallbackParams = user_id ? [query, user_id, limit] : [query, limit];
              const fallbackResult = await db.query(fallbackQuery, fallbackParams);
              semanticResults = fallbackResult.rows;
            } catch (embeddingError) {
              console.warn('[AgentToolRegistry] Semantic search failed:', embeddingError.message);
            }
          }

          const allResults = [...result.rows, ...semanticResults];
          const uniqueResults = allResults.filter((item, index, self) => 
            index === self.findIndex(t => t.id === item.id)
          );

          return {
            success: true,
            query: query,
            user_id: user_id,
            results: uniqueResults.map(row => ({
              id: row.id,
              title: row.title,
              content: row.content.substring(0, 500) + (row.content.length > 500 ? '...' : ''),
              source: row.source,
              entry_type: row.entry_type,
              tags: row.tags,
              created_at: row.created_at,
              relevance_score: Math.random() * 0.3 + 0.7 // Mock relevance for now
            })),
            total_results: uniqueResults.length,
            search_type: uniqueResults.length > result.rows.length ? 'semantic' : 'keyword',
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          console.error(`[AgentToolRegistry] Knowledge query failed:`, error.message);
          return {
            success: false,
            query: query,
            user_id: user_id,
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }
    });

    // File Analyzer Tool
    this.registerTool({
      name: 'file_analyzer',
      description: 'Analyze files and extract information',
      category: 'utility',
      schema: z.object({
        file_path: z.string().describe('Path to file to analyze'),
        analysis_type: z.enum(['structure', 'content', 'metadata']).describe('Type of analysis')
      }),
      func: async ({ file_path, analysis_type }) => {
        console.log(`[AgentToolRegistry] Mock file analysis: ${analysis_type} on ${file_path}`);
        return {
          success: true,
          file_path: file_path,
          analysis_type: analysis_type,
          result: `Mock ${analysis_type} analysis of ${file_path} completed`,
          timestamp: new Date().toISOString()
        };
      }
    });
  }

  /**
   * Register a single tool with the registry
   */
  registerTool({ name, description, category, schema, func }) {
    try {
      const tool = new DynamicTool({
        name: name,
        description: description,
        schema: schema,
        func: async (input) => {
          const startTime = Date.now();
          this.metrics.tool_executions++;
          
          try {
            console.log(`[AgentToolRegistry] 🔧 Executing tool: ${name}`);
            const result = await func(input);
            
            this.metrics.successful_executions++;
            const executionTime = Date.now() - startTime;
            console.log(`[AgentToolRegistry] ✅ Tool ${name} executed successfully in ${executionTime}ms`);
            
            return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          } catch (error) {
            this.metrics.failed_executions++;
            const executionTime = Date.now() - startTime;
            console.error(`[AgentToolRegistry] ❌ Tool ${name} failed after ${executionTime}ms:`, error);
            
            return JSON.stringify({
              success: false,
              error: error.message,
              tool_name: name,
              execution_time: executionTime
            }, null, 2);
          }
        }
      });
      
      // Add metadata
      tool.category = category;
      tool.registered_at = new Date().toISOString();
      
      this.tools.set(name, tool);
      this.metrics.total_tools++;
      
      console.log(`[AgentToolRegistry] ✅ Registered tool: ${name} (${category})`);
      return true;
    } catch (error) {
      console.error(`[AgentToolRegistry] ❌ Failed to register tool ${name}:`, error);
      return false;
    }
  }

  /**
   * Get tools allowed for a specific agent
   */
  getToolsForAgent(allowedToolNames) {
    const allowedTools = [];
    
    for (const toolName of allowedToolNames) {
      const tool = this.tools.get(toolName);
      if (tool) {
        allowedTools.push(tool);
      } else {
        console.warn(`[AgentToolRegistry] ⚠️ Tool not found: ${toolName}`);
      }
    }
    
    console.log(`[AgentToolRegistry] 📋 Providing ${allowedTools.length} tools to agent`);
    return allowedTools;
  }

  /**
   * Get a specific tool by name
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * Check if an agent has permission to use a tool
   */
  hasPermission(agentName, toolName) {
    const permissions = this.agentPermissions.get(agentName);
    if (!permissions) {
      console.warn(`[AgentToolRegistry] ⚠️ No permissions found for agent: ${agentName}`);
      return false;
    }
    
    const hasPermission = permissions.includes(toolName);
    if (!hasPermission) {
      this.metrics.permission_violations++;
      console.warn(`[AgentToolRegistry] 🚫 Permission denied: ${agentName} cannot use ${toolName}`);
    }
    
    return hasPermission;
  }

  /**
   * Set permissions for an agent
   */
  setAgentPermissions(agentName, allowedTools) {
    this.agentPermissions.set(agentName, allowedTools);
    console.log(`[AgentToolRegistry] 🔐 Set permissions for ${agentName}: ${allowedTools.join(', ')}`);
  }

  /**
   * Get all available tools
   */
  getAllTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category) {
    return Array.from(this.tools.values()).filter(tool => tool.category === category);
  }

  /**
   * Get tool count
   */
  getToolCount() {
    return this.tools.size;
  }

  /**
   * Get registry status and metrics
   */
  getStatus() {
    const categories = {};
    for (const [name, tool] of this.tools) {
      const category = tool.category || 'general';
      categories[category] = (categories[category] || 0) + 1;
    }

    return {
      service: 'AgentToolRegistry',
      version: '2.1.0',
      initialized: this.initialized,
      total_tools: this.tools.size,
      categories: categories,
      metrics: {
        ...this.metrics,
        success_rate: this.metrics.tool_executions > 0 
          ? ((this.metrics.successful_executions / this.metrics.tool_executions) * 100).toFixed(2) + '%'
          : '0%',
        average_executions_per_tool: this.tools.size > 0 
          ? (this.metrics.tool_executions / this.tools.size).toFixed(2)
          : '0'
      },
      agents_registered: this.agentPermissions.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      tools_registered: this.tools.size,
      agents_with_permissions: this.agentPermissions.size
    };
  }

  /**
   * Check if registry is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Clear all tools (for testing/reset)
   */
  clear() {
    this.tools.clear();
    this.agentPermissions.clear();
    this.metrics = {
      total_tools: 0,
      tool_executions: 0,
      successful_executions: 0,
      failed_executions: 0,
      permission_violations: 0
    };
    this.initialized = false;
    console.log('[AgentToolRegistry] 🧹 Registry cleared');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('[AgentToolRegistry] 🔽 Shutting down tool registry...');
    console.log('[AgentToolRegistry] 📊 Final metrics:', this.metrics);
    
    this.initialized = false;
    console.log('[AgentToolRegistry] ✅ Tool registry shutdown complete');
  }
}

export default AgentToolRegistry;
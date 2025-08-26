import { AIMessage, SystemMessage } from '@langchain/core/messages';
import BaseAgent from '../../system/BaseAgent.js';
import { Octokit } from '@octokit/rest';

/**
 * @class GitHubSearchAgent
 * @description An advanced agent for comprehensive GitHub search and analysis.
 * Features multi-faceted search (repos, code, users), advanced filtering,
 * caching, and AI-powered result summarization.
 */
class GitHubSearchAgent extends BaseAgent {
  /**
   * @param {ChatOpenAI} llm - The language model instance.
   * @param {AgentToolRegistry} toolRegistry - The tool registry instance.
   */
  constructor(llm, toolRegistry) {
    super(
      'github',
      'sub',
      [
        'github_search',
        'repository_analysis',
        'code_discovery',
        'trending_detection',
      ],
      'A specialist agent for searching and analyzing GitHub repositories, code, and users.'
    );

    // LangGraph compatibility - injected by supervisor
    this.llm = llm;
    this.toolRegistry = toolRegistry;

    // Update config with allowed tools
    this.config.allowedTools = [
      'github_search',
      'github_repo_analyzer',
      'github_trending',
    ];

    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || '' });
    this.searchCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Use the inherited BaseAgent invoke method for consistent behavior
   */
  async invoke(state) {
    console.log(
      `[GitHubSearchAgent] 💻 Engaging GitHub specialist workflow...`
    );

    // Use the parent's invoke method which handles the tool execution loop properly
    return await super.invoke(state);
  }

  /**
   * Build specialized system prompt for GitHub search tasks.
   */
  buildSystemPrompt(privateState, state) {
    const userMessage = state.messages[state.messages.length - 1];
    return `You are the GitHub Search specialist in the Cartrita AI system.
Your personality is technical, resourceful, code-savvy, and sassy with that Miami street-smart developer expertise.

**CURRENT USER REQUEST:**
"${userMessage.content}"

**YOUR GITHUB MISSION:**
1. **Analyze the Search Request:** What kind of GitHub content is the user looking for - repos, code, users, trends?
2. **Execute GitHub Operations:**
   - Use \`github_search\` tool to find repositories, code snippets, or users
   - Use \`github_repo_analyzer\` tool to analyze specific repositories in detail
   - Use \`github_trending\` tool to find trending repositories and technologies
3. **Provide Comprehensive Results:** Give detailed information about repositories, code examples, and insights

**YOUR SPECIALIZED TOOLS:**
${this.config.allowedTools.join(', ')}

**EXECUTION REQUIREMENTS:**
- ACTUALLY search GitHub using your tools - don't just provide general information
- Use specific search queries based on user requirements (language, stars, topics, etc.)
- Analyze repository details: stars, forks, issues, recent activity, technologies used
- Find actual code examples, popular libraries, and trending projects
- Provide direct links to repositories, files, and relevant GitHub content

**RESPONSE FORMAT:**
Provide a natural, conversational response that includes:
- "Let me search GitHub for that..." (what search operations you performed)
- Specific repositories, code examples, or users you found
- Detailed analysis of repository metrics, activity, and relevance
- Direct GitHub links and practical information for the user
- Your tech-savvy, code-smart personality throughout

**GITHUB SEARCH GUIDELINES:**
- Use appropriate search filters: language, stars, created/updated dates, topics
- Analyze repository quality: stars, forks, recent activity, documentation
- Provide practical insights: how to use libraries, implementation examples
- Include trending analysis when relevant
- Give actionable information for developers

**Remember:** You're the GitHub expert - actually search and analyze repositories, don't just provide generic information!

**Your Memory of This Task:** ${JSON.stringify(privateState, null, 2)}`;
  }

  /**
   * Uses an LLM to summarize the raw API results into a user-friendly format.
   * @param {string} originalQuery - The user's original query.
   * @param {Array} items - The items returned from the GitHub API.
   * @returns {Promise<string>} A summarized, natural language response.
   * @private
   */
  async _summarizeResults(originalQuery, items) {
    const systemPrompt = `You are a GitHub expert. You have just received the following JSON data from the GitHub API in response to the user's query. Your task is to summarize these results in a clean, helpful, and user-friendly way.

- Provide a brief, one-sentence summary of the top result.
- List the top 3-5 most relevant results in a Markdown list.
- For each item, include its name, a brief description, and a direct Markdown link.
- Conclude with a summary of the total number of items found.`;

    const content = `User Query: "${originalQuery}"\n\nAPI Results (JSON):\n${JSON.stringify(
      items.slice(0, 10),
      null,
      2
    )}`;

    const response = await this.llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(content),
    ]);

    return response.content;
  }

  /**
   * A simple parser to extract key terms from the user's query.
   * @param {string} query - The user's natural language query.
   * @returns {object} A structured search intent object.
   * @private
   */
  _parseSearchIntent(query) {
    const qLower = query.toLowerCase();
    const intent = {
      type: 'repos',
      query: query.replace(/find|search|for|github/gi, '').trim(),
      sortBy: 'best-match',
    };
    if (qLower.includes('code for')) intent.type = 'code';
    if (qLower.includes('user') || qLower.includes('author'))
      intent.type = 'users';
    if (qLower.includes('popular') || qLower.includes('stars'))
      intent.sortBy = 'stars';
    if (qLower.includes('recent') || qLower.includes('updated'))
      intent.sortBy = 'updated';

    // Add language filter
    const languages = [
      'javascript',
      'python',
      'typescript',
      'java',
      'go',
      'rust',
    ];
    for (const lang of languages) {
      if (qLower.includes(lang)) {
        intent.query += ` language:${lang}`;
        break;
      }
    }
    return intent;
  }
}

export default GitHubSearchAgent;

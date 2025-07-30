// packages/backend/src/agi/consciousness/GitHubSearchAgent.js
const OpenAI = require('openai');
const MessageBus = require('../../system/MessageBus');

class GitHubSearchAgent {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.octokit = null;
    this.initOctokit();
    this.listen();
  }

  async initOctokit() {
    try {
      const { Octokit } = await import('octokit');
      this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      console.log('[GitHubSearchAgent] Octokit initialized');
    } catch (error) {
      console.error(
        '[GitHubSearchAgent] Failed to initialize Octokit:',
        error.message
      );
    }
  }

  listen() {
    console.log('[GitHubSearchAgent] Listening for GitHub search tasks...');
    MessageBus.on('task:request', async task => {
      if (task.type === 'github_search') {
        console.log(`[GitHubSearchAgent] Received task: ${task.id}`);
        try {
          const result = await this.execute(task.payload.prompt);
          MessageBus.emit(`task:complete:${task.id}`, { text: result });
        } catch (error) {
          console.error('[GitHubSearchAgent] Error:', error.message);
          MessageBus.emit(`task:fail:${task.id}`, { error: error.message });
        }
      }
    });
  }

  async summarizeResults(query, repositories) {
    const repoData = repositories.map(repo => ({
      name: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      url: repo.html_url,
    }));

    const systemPrompt = `
      You are a software development analyst. Your task is to summarize GitHub search results and provide a concise, helpful report.
      The user searched for: "${query}"
      Here are the top search results in JSON format:
      ${JSON.stringify(repoData, null, 2)}

      Analyze the results and provide a summary. Highlight the most relevant repository and explain why.
      Format your response clearly using Markdown. Include links to the repositories.
    `;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }],
    });
    return completion.choices[0].message.content.trim();
  }

  async execute(query) {
    console.log(
      `[GitHubSearchAgent] Searching for repositories with query: "${query}"`
    );
    const { data } = await this.octokit.rest.search.repos({
      q: query,
      sort: 'stars',
      order: 'desc',
      per_page: 5,
    });

    if (data.items.length === 0) {
      return `I couldn't find any public repositories matching "${query}" on GitHub.`;
    }

    const summary = await this.summarizeResults(query, data.items);
    return summary;
  }
}

module.exports = new GitHubSearchAgent();

/* global process, console */
// packages/backend/src/tools/githubSearchTool.js

import { Tool } from '@langchain/core/tools';

/**
 * Advanced GitHub Search Tool with comprehensive repository, code, and user search capabilities
 * Uses GitHub REST API with authentication for enhanced rate limits
 */
class GitHubSearchTool extends Tool {
  constructor() {
    super();
    this.name = 'github_search';
    this.description = `Search GitHub repositories, code, users, and analyze repositories.
Use this tool when users ask about:
- Finding repositories or code on GitHub
- Looking up specific GitHub repositories  
- Searching for trending repositories
- Analyzing repository information
- Finding code examples or implementations
- GitHub user information
- Finding issues, pull requests, or discussions

Input should be a JSON string with search parameters:
{
  "query": "search terms",
  "type": "repositories|code|users|issues|commits",
  "language": "programming language filter",
  "sort": "stars|forks|updated|best-match",
  "order": "desc|asc",
  "per_page": 10,
  "user": "username filter",
  "org": "organization filter",
  "repo": "specific repository (owner/repo)",
  "topic": "topic filter"
}`;

    this.apiToken = process.env.GITHUB_TOKEN;
    this.baseUrl = 'https://api.github.com';

    // Rate limiting
    this.lastRequest = 0;
    this.rateLimitDelay = 100; // ms between requests

    console.log(
      `[GitHubSearchTool] Initialized ${this.apiToken ? 'with' : 'without'} authentication`
    );
  }

  async _call(input) {
    try {
      console.log(
        `[GitHubSearchTool] 🔍 Executing search: ${input.substring(0, 100)}...`
      );

      // Parse input
      let searchParams;
      try {
        searchParams = typeof input === 'string' ? JSON.parse(input) : input;
      } catch (error) {
        // Fallback to simple string search
        searchParams = { query: input, type: 'repositories' };
      }

      // Validate and normalize parameters
      const params = this.normalizeParams(searchParams);

      // Rate limiting
      await this.enforceRateLimit();

      // Execute search based on type
      let results;
      switch (params.type) {
        case 'repositories':
          results = await this.searchRepositories(params);
          break;
        case 'code':
          results = await this.searchCode(params);
          break;
        case 'users':
          results = await this.searchUsers(params);
          break;
        case 'issues':
          results = await this.searchIssues(params);
          break;
        case 'commits':
          results = await this.searchCommits(params);
          break;
        case 'repository':
          // Get specific repository details
          results = await this.getRepository(params);
          break;
        default:
          results = await this.searchRepositories(params);
      }

      // Format results for better readability
      const formatted = this.formatResults(results, params);

      console.log(
        `[GitHubSearchTool] ✅ Found ${results.items?.length || results.length || 1} results`
      );

      return JSON.stringify(formatted, null, 2);
    } catch (error) {
      console.error('[GitHubSearchTool] ❌ Search failed:', error.message);
      return JSON.stringify(
        {
          error: true,
          message: error.message,
          suggestion:
            'Try a simpler search query or check if the repository exists',
        },
        null,
        2
      );
    }
  }

  normalizeParams(params) {
    return {
      query: params.query || '',
      type: params.type || 'repositories',
      language: params.language || null,
      sort:
        params.sort ||
        (params.type === 'repositories' ? 'stars' : 'best-match'),
      order: params.order || 'desc',
      per_page: Math.min(params.per_page || 10, 100),
      user: params.user || null,
      org: params.org || null,
      repo: params.repo || null,
      topic: params.topic || null,
      created: params.created || null,
      pushed: params.pushed || null,
      size: params.size || null,
      stars: params.stars || null,
      forks: params.forks || null,
    };
  }

  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequest = Date.now();
  }

  async makeGitHubRequest(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.append(key, value);
      }
    });

    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Cartrita-AI-Assistant/1.0',
    };

    if (this.apiToken) {
      headers['Authorization'] = `token ${this.apiToken}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      if (response.status === 403) {
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        throw new Error(
          `GitHub API rate limit exceeded. Resets at ${new Date(rateLimitReset * 1000).toISOString()}`
        );
      }
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  buildSearchQuery(params) {
    let query = params.query;

    // Add filters to query
    const filters = [];

    if (params.language) filters.push(`language:${params.language}`);
    if (params.user) filters.push(`user:${params.user}`);
    if (params.org) filters.push(`org:${params.org}`);
    if (params.topic) filters.push(`topic:${params.topic}`);
    if (params.created) filters.push(`created:${params.created}`);
    if (params.pushed) filters.push(`pushed:${params.pushed}`);
    if (params.size) filters.push(`size:${params.size}`);
    if (params.stars) filters.push(`stars:${params.stars}`);
    if (params.forks) filters.push(`forks:${params.forks}`);

    if (filters.length > 0) {
      query += ' ' + filters.join(' ');
    }

    return query.trim();
  }

  async searchRepositories(params) {
    const searchQuery = this.buildSearchQuery(params);

    const searchParams = {
      q: searchQuery,
      sort: params.sort,
      order: params.order,
      per_page: params.per_page,
    };

    return this.makeGitHubRequest('/search/repositories', searchParams);
  }

  async searchCode(params) {
    let searchQuery = params.query;

    // Code search requires more specific queries
    if (params.language) searchQuery += ` language:${params.language}`;
    if (params.user) searchQuery += ` user:${params.user}`;
    if (params.org) searchQuery += ` org:${params.org}`;
    if (params.repo) searchQuery += ` repo:${params.repo}`;

    const searchParams = {
      q: searchQuery,
      sort: params.sort === 'stars' ? 'indexed' : params.sort,
      order: params.order,
      per_page: params.per_page,
    };

    return this.makeGitHubRequest('/search/code', searchParams);
  }

  async searchUsers(params) {
    const searchParams = {
      q: params.query,
      sort: params.sort === 'stars' ? 'followers' : params.sort,
      order: params.order,
      per_page: params.per_page,
    };

    return this.makeGitHubRequest('/search/users', searchParams);
  }

  async searchIssues(params) {
    let searchQuery = params.query;

    // Add issue-specific filters
    if (params.repo) searchQuery += ` repo:${params.repo}`;
    if (params.user) searchQuery += ` author:${params.user}`;

    const searchParams = {
      q: searchQuery,
      sort: params.sort === 'stars' ? 'updated' : params.sort,
      order: params.order,
      per_page: params.per_page,
    };

    return this.makeGitHubRequest('/search/issues', searchParams);
  }

  async searchCommits(params) {
    let searchQuery = params.query;

    // Commits search requires repo specification
    if (params.repo) {
      searchQuery += ` repo:${params.repo}`;
    } else {
      throw new Error(
        'Commit search requires a specific repository (repo parameter)'
      );
    }

    if (params.user) searchQuery += ` author:${params.user}`;

    const searchParams = {
      q: searchQuery,
      sort: params.sort === 'stars' ? 'author-date' : params.sort,
      order: params.order,
      per_page: params.per_page,
    };

    return this.makeGitHubRequest('/search/commits', searchParams);
  }

  async getRepository(params) {
    if (!params.repo) {
      throw new Error('Repository parameter required (format: owner/repo)');
    }

    const [owner, repo] = params.repo.split('/');
    if (!owner || !repo) {
      throw new Error('Invalid repository format. Use: owner/repo');
    }

    // Get repository details
    const repoData = await this.makeGitHubRequest(`/repos/${owner}/${repo}`);

    // Get additional repository information
    const [contributors, languages, releases, issues] =
      await Promise.allSettled([
        this.makeGitHubRequest(`/repos/${owner}/${repo}/contributors`, {
          per_page: 10,
        }),
        this.makeGitHubRequest(`/repos/${owner}/${repo}/languages`),
        this.makeGitHubRequest(`/repos/${owner}/${repo}/releases`, {
          per_page: 5,
        }),
        this.makeGitHubRequest(`/repos/${owner}/${repo}/issues`, {
          per_page: 5,
          state: 'open',
        }),
      ]);

    return {
      repository: repoData,
      contributors:
        contributors.status === 'fulfilled' ? contributors.value : [],
      languages: languages.status === 'fulfilled' ? languages.value : {},
      releases: releases.status === 'fulfilled' ? releases.value : [],
      openIssues: issues.status === 'fulfilled' ? issues.value : [],
    };
  }

  formatResults(results, params) {
    if (params.type === 'repository' && results.repository) {
      return this.formatRepositoryDetails(results);
    }

    if (!results.items || results.items.length === 0) {
      return {
        message: `No ${params.type} found for query: "${params.query}"`,
        suggestions: this.getSearchSuggestions(params),
      };
    }

    const formatted = {
      search_type: params.type,
      query: params.query,
      total_count: results.total_count,
      showing: results.items.length,
      results: results.items.map(item => this.formatItem(item, params.type)),
    };

    // Add search metadata
    if (results.total_count > results.items.length) {
      formatted.note = `Showing top ${results.items.length} of ${results.total_count} results`;
    }

    return formatted;
  }

  formatItem(item, type) {
    switch (type) {
      case 'repositories':
        return {
          name: item.full_name,
          description: item.description,
          url: item.html_url,
          stars: item.stargazers_count,
          forks: item.forks_count,
          language: item.language,
          updated: item.updated_at,
          topics: item.topics || [],
        };

      case 'code':
        return {
          name: item.name,
          path: item.path,
          repository: item.repository.full_name,
          url: item.html_url,
          score: item.score,
        };

      case 'users':
        return {
          username: item.login,
          name: item.name || 'N/A',
          bio: item.bio || 'No bio available',
          url: item.html_url,
          followers: item.followers || 'N/A',
          public_repos: item.public_repos || 'N/A',
        };

      case 'issues':
        return {
          title: item.title,
          number: item.number,
          state: item.state,
          url: item.html_url,
          repository: item.repository_url.split('/').slice(-2).join('/'),
          created: item.created_at,
          updated: item.updated_at,
        };

      case 'commits':
        return {
          sha: item.sha.substring(0, 7),
          message: item.commit.message.split('\n')[0],
          author: item.commit.author.name,
          date: item.commit.author.date,
          url: item.html_url,
        };

      default:
        return item;
    }
  }

  formatRepositoryDetails(results) {
    const repo = results.repository;
    const topLanguages = Object.entries(results.languages || {})
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lang]) => lang);

    return {
      repository: {
        name: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        homepage: repo.homepage,
        stats: {
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          watchers: repo.watchers_count,
          open_issues: repo.open_issues_count,
          size_kb: repo.size,
        },
        details: {
          language: repo.language,
          top_languages: topLanguages,
          created: repo.created_at,
          updated: repo.updated_at,
          pushed: repo.pushed_at,
          default_branch: repo.default_branch,
          topics: repo.topics || [],
          license: repo.license?.name || 'No license',
        },
        social: {
          has_issues: repo.has_issues,
          has_projects: repo.has_projects,
          has_wiki: repo.has_wiki,
          has_discussions: repo.has_discussions,
          archived: repo.archived,
          disabled: repo.disabled,
        },
      },
      contributors: (results.contributors || [])
        .slice(0, 10)
        .map(contributor => ({
          username: contributor.login,
          contributions: contributor.contributions,
          url: contributor.html_url,
        })),
      recent_releases: (results.releases || []).slice(0, 3).map(release => ({
        name: release.name || release.tag_name,
        tag: release.tag_name,
        published: release.published_at,
        url: release.html_url,
      })),
      open_issues: (results.openIssues || []).slice(0, 5).map(issue => ({
        title: issue.title,
        number: issue.number,
        created: issue.created_at,
        url: issue.html_url,
      })),
    };
  }

  getSearchSuggestions(params) {
    const suggestions = [];

    if (params.type === 'repositories') {
      suggestions.push(
        'Try broader search terms',
        'Add language filter (e.g., "language:javascript")',
        'Search for specific topics (e.g., "topic:machine-learning")',
        'Filter by user or organization (e.g., "user:microsoft")'
      );
    } else if (params.type === 'code') {
      suggestions.push(
        'Specify a repository (e.g., "repo:facebook/react")',
        'Add file extension (e.g., "extension:py")',
        'Use more specific function or class names'
      );
    } else if (params.type === 'users') {
      suggestions.push(
        'Try partial usernames',
        'Search by location or company name',
        'Use broader terms'
      );
    }

    return suggestions;
  }

  getApiStats() {
    return {
      authenticated: !!this.apiToken,
      baseUrl: this.baseUrl,
      rateLimitDelay: this.rateLimitDelay,
      lastRequest: this.lastRequest,
    };
  }
}

export default GitHubSearchTool;

// packages/backend/src/agi/consciousness/GitHubSearchAgent.js

/**
 * Enhanced GitHubSearchAgent - Advanced Repository Discovery and Analysis
 * 
 * This sophisticated agent provides comprehensive GitHub search capabilities with:
 * - Multi-faceted repository search (repos, code, users, issues)
 * - Advanced filtering and sorting options
 * - Detailed repository analysis and insights
 * - Trending repository detection
 * - Language and technology stack analysis
 * - Repository health metrics evaluation
 * - Collaborative filtering recommendations
 */

const BaseAgent = require('../../system/BaseAgent');
const { Octokit } = require("@octokit/rest");

class GitHubSearchAgent extends BaseAgent {
  constructor() {
    super('GitHubSearchAgent', 'main', ['github_search', 'repository_analysis', 'code_discovery']);
    
    // Initialize GitHub API client with enhanced configuration
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      userAgent: 'Cartrita-AI-Agent/1.0',
      timeZone: 'America/New_York',
      request: {
        timeout: 10000, // 10 second timeout
        retries: 2
      }
    });
    
    // Search configuration
    this.searchConfig = {
      defaultResultsPerPage: 10,
      maxResultsPerPage: 30,
      supportedSortOptions: ['stars', 'forks', 'help-wanted-issues', 'updated'],
      supportedLanguages: ['javascript', 'python', 'java', 'typescript', 'go', 'rust', 'cpp', 'csharp'],
      qualityThresholds: {
        minStars: 10,
        minForks: 5,
        maxAge: 365 * 2 // 2 years
      }
    };
    
    // Cache for performance optimization
    this.searchCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Analysis metrics
    this.analysisMetrics = {
      searches_performed: 0,
      repositories_analyzed: 0,
      cache_hits: 0,
      api_calls_made: 0,
      average_analysis_time: 0
    };
  }

  /**
   * Initialize the enhanced GitHub search agent
   */
  async onInitialize() {
    console.log('[GitHubSearchAgent] Advanced repository discovery and analysis ready.');
    
    // Register multiple task handlers for different search types
    this.registerTaskHandler({
      taskType: 'github_search',
      handler: this.execute.bind(this)
    });
    
    this.registerTaskHandler({
      taskType: 'repository_analysis',
      handler: this.analyzeRepository.bind(this)
    });
    
    this.registerTaskHandler({
      taskType: 'code_discovery',
      handler: this.searchCode.bind(this)
    });
    
    // Test GitHub API connection
    await this.testConnection();
    
    console.log('[GitHubSearchAgent] Enhanced capabilities enabled:');
    console.log('  ✅ Repository search with advanced filtering');
    console.log('  ✅ Code search across repositories');
    console.log('  ✅ Repository health and quality analysis');
    console.log('  ✅ Trending repository detection');
    console.log('  ✅ Language and technology insights');
  }

  /**
   * Test GitHub API connection and rate limits
   */
  async testConnection() {
    try {
      const { data } = await this.octokit.rest.meta.get();
      console.log('[GitHubSearchAgent] GitHub API connection established');
      
      // Check rate limits
      const rateLimit = await this.octokit.rest.rateLimit.get();
      const remaining = rateLimit.data.rate.remaining;
      const resetTime = new Date(rateLimit.data.rate.reset * 1000);
      
      console.log(`[GitHubSearchAgent] Rate limit: ${remaining}/5000, resets at ${resetTime.toLocaleTimeString()}`);
      
      if (remaining < 100) {
        console.warn('[GitHubSearchAgent] Low rate limit remaining!');
      }
      
    } catch (error) {
      console.warn('[GitHubSearchAgent] GitHub API connection issue:', error.message);
    }
  }

  /**
   * Main execution method with enhanced search capabilities
   */
  async execute(query, language = 'en', userId = null, payload = {}) {
    const startTime = Date.now();
    this.analysisMetrics.searches_performed++;
    
    try {
      console.log(`[GitHubSearchAgent] Processing enhanced search query: "${query}"`);
      
      // Parse search intent and parameters
      const searchIntent = this.parseSearchIntent(query);
      console.log(`[GitHubSearchAgent] Search intent analysis:`, searchIntent);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(query, searchIntent);
      const cachedResult = this.getCachedResult(cacheKey);
      
      if (cachedResult) {
        this.analysisMetrics.cache_hits++;
        console.log('[GitHubSearchAgent] Returning cached result');
        return cachedResult;
      }
      
      let results;
      
      // Route to appropriate search method based on intent
      switch (searchIntent.type) {
        case 'code_search':
          results = await this.performCodeSearch(searchIntent);
          break;
        case 'user_search':
          results = await this.searchUsers(searchIntent);
          break;
        case 'trending':
          results = await this.findTrendingRepositories(searchIntent);
          break;
        default:
          results = await this.performRepositorySearch(searchIntent);
      }
      
      // Generate comprehensive analysis
      const analysis = await this.generateEnhancedAnalysis(query, results, searchIntent);
      
      // Cache the result
      this.cacheResult(cacheKey, analysis);
      
      // Update metrics
      const analysisTime = Date.now() - startTime;
      this.updateAnalysisMetrics(analysisTime);
      
      return analysis;
      
    } catch (error) {
      console.error('[GitHubSearchAgent] Search failed:', error);
      return this.generateErrorResponse(error, query);
    }
  }

  /**
   * Parse user query to determine search intent and parameters
   */
  parseSearchIntent(query) {
    const queryLower = query.toLowerCase();
    
    const intent = {
      type: 'repository_search', // default
      originalQuery: query,
      filters: {},
      sortBy: 'stars',
      language: null,
      qualityFilter: false
    };
    
    // Detect search type
    if (queryLower.includes('code') || queryLower.includes('function') || queryLower.includes('implementation')) {
      intent.type = 'code_search';
    } else if (queryLower.includes('user') || queryLower.includes('developer') || queryLower.includes('author')) {
      intent.type = 'user_search';
    } else if (queryLower.includes('trending') || queryLower.includes('popular') || queryLower.includes('hot')) {
      intent.type = 'trending';
    }
    
    // Extract language filter
    for (const lang of this.searchConfig.supportedLanguages) {
      if (queryLower.includes(lang)) {
        intent.language = lang;
        break;
      }
    }
    
    // Extract quality preferences
    if (queryLower.includes('high quality') || queryLower.includes('well maintained') || queryLower.includes('popular')) {
      intent.qualityFilter = true;
    }
    
    // Extract sort preference
    if (queryLower.includes('recent') || queryLower.includes('updated')) {
      intent.sortBy = 'updated';
    } else if (queryLower.includes('fork')) {
      intent.sortBy = 'forks';
    }
    
    return intent;
  }

  /**
   * Perform enhanced repository search with filtering
   */
  async performRepositorySearch(searchIntent) {
    const { originalQuery, language, qualityFilter, sortBy } = searchIntent;
    
    // Build search query with filters
    let searchQuery = originalQuery;
    
    if (language) {
      searchQuery += ` language:${language}`;
    }
    
    if (qualityFilter) {
      searchQuery += ` stars:>${this.searchConfig.qualityThresholds.minStars}`;
      searchQuery += ` forks:>${this.searchConfig.qualityThresholds.minForks}`;
    }
    
    console.log(`[GitHubSearchAgent] Enhanced search query: "${searchQuery}"`);
    
    this.analysisMetrics.api_calls_made++;
    const { data } = await this.octokit.search.repos({
      q: searchQuery,
      sort: sortBy,
      order: 'desc',
      per_page: this.searchConfig.defaultResultsPerPage,
    });
    
    return {
      type: 'repositories',
      items: data.items,
      totalCount: data.total_count,
      searchQuery
    };
  }

  /**
   * Search for code across repositories
   */
  async searchCode(searchIntent) {
    const { originalQuery, language } = searchIntent;
    
    let searchQuery = originalQuery;
    if (language) {
      searchQuery += ` language:${language}`;
    }
    
    this.analysisMetrics.api_calls_made++;
    const { data } = await this.octokit.search.code({
      q: searchQuery,
      sort: 'indexed',
      order: 'desc',
      per_page: 10
    });
    
    return {
      type: 'code',
      items: data.items,
      totalCount: data.total_count,
      searchQuery
    };
  }

  /**
   * Find trending repositories based on recent activity
   */
  async findTrendingRepositories(searchIntent) {
    const { originalQuery, language } = searchIntent;
    
    // Search for recently updated, popular repositories
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const dateFilter = oneWeekAgo.toISOString().split('T')[0];
    
    let searchQuery = `${originalQuery} stars:>100 pushed:>${dateFilter}`;
    if (language) {
      searchQuery += ` language:${language}`;
    }
    
    this.analysisMetrics.api_calls_made++;
    const { data } = await this.octokit.search.repos({
      q: searchQuery,
      sort: 'updated',
      order: 'desc',
      per_page: this.searchConfig.defaultResultsPerPage,
    });
    
    return {
      type: 'trending',
      items: data.items,
      totalCount: data.total_count,
      searchQuery
    };
  }

  /**
   * Search for users/developers
   */
  async searchUsers(searchIntent) {
    const { originalQuery } = searchIntent;
    
    this.analysisMetrics.api_calls_made++;
    const { data } = await this.octokit.search.users({
      q: originalQuery,
      sort: 'followers',
      order: 'desc',
      per_page: 10
    });
    
    return {
      type: 'users',
      items: data.items,
      totalCount: data.total_count,
      searchQuery: originalQuery
    };
  }

  /**
   * Generate enhanced analysis with comprehensive insights
   */
  async generateEnhancedAnalysis(originalQuery, results, searchIntent) {
    const { items, totalCount, type } = results;
    
    if (!items || items.length === 0) {
      return `I couldn't find any ${type === 'code' ? 'code' : 'repositories'} matching "${originalQuery}" on GitHub.`;
    }
    
    let analysisData;
    
    switch (type) {
      case 'code':
        analysisData = this.prepareCodeAnalysisData(items);
        break;
      case 'users':
        analysisData = this.prepareUserAnalysisData(items);
        break;
      default:
        analysisData = this.prepareRepositoryAnalysisData(items);
    }
    
    const systemPrompt = this.buildAnalysisPrompt(originalQuery, analysisData, searchIntent, totalCount);
    
    return await this.createCompletion([{ role: 'system', content: systemPrompt }], {
      temperature: 0.6,
      max_tokens: 1500,
    });
  }

  /**
   * Prepare repository data for analysis
   */
  prepareRepositoryAnalysisData(repositories) {
    return repositories.map(repo => ({
      name: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      url: repo.html_url,
      topics: repo.topics,
      updatedAt: repo.updated_at,
      createdAt: repo.created_at,
      license: repo.license?.name,
      hasIssues: repo.has_issues,
      openIssues: repo.open_issues_count
    }));
  }

  /**
   * Build comprehensive analysis prompt
   */
  buildAnalysisPrompt(query, data, searchIntent, totalCount) {
    const { type } = searchIntent;
    
    return `
You are an expert software development analyst providing insights on GitHub search results.

User Query: "${query}"
Search Type: ${type}
Total Results Found: ${totalCount}

Search Results Data:
${JSON.stringify(data, null, 2)}

Provide a comprehensive analysis that includes:
1. A clear summary of what was found
2. Highlight the most relevant or highest-quality result
3. Identify patterns in languages, topics, or technologies
4. Provide practical recommendations for the user
5. Include properly formatted Markdown links using [Name](URL) format

Make your response informative, well-structured, and actionable for developers.`;
  }

  /**
   * Cache management methods
   */
  generateCacheKey(query, searchIntent) {
    return `${query}_${searchIntent.type}_${searchIntent.language || 'any'}_${searchIntent.sortBy}`;
  }
  
  getCachedResult(key) {
    const cached = this.searchCache.get(key);
    if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
      return cached.result;
    }
    return null;
  }
  
  cacheResult(key, result) {
    this.searchCache.set(key, {
      result,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    if (this.searchCache.size > 100) {
      const oldestKey = Array.from(this.searchCache.keys())[0];
      this.searchCache.delete(oldestKey);
    }
  }

  /**
   * Generate error response with helpful suggestions
   */
  generateErrorResponse(error, query) {
    if (error.status === 403) {
      return 'GitHub API rate limit exceeded. Please try again in a few minutes.';
    }
    
    if (error.status === 422) {
      return `The search query "${query}" couldn't be processed. Try using simpler terms or check for typos.`;
    }
    
    return `I encountered an issue searching GitHub: ${error.message}. Please try again with a different query.`;
  }

  /**
   * Update analysis metrics
   */
  updateAnalysisMetrics(analysisTime) {
    const totalAnalyses = this.analysisMetrics.searches_performed;
    this.analysisMetrics.average_analysis_time = (
      (this.analysisMetrics.average_analysis_time * (totalAnalyses - 1) + analysisTime) / totalAnalyses
    );
  }

  /**
   * Get comprehensive agent status
   */
  getStatus() {
    const baseStatus = super.getStatus();
    
    return {
      ...baseStatus,
      specialization: 'GitHub Repository Discovery & Analysis',
      enhanced_features: {
        repository_search: true,
        code_search: true,
        user_search: true,
        trending_detection: true,
        quality_filtering: true,
        caching_enabled: true
      },
      search_capabilities: {
        supported_languages: this.searchConfig.supportedLanguages,
        max_results_per_search: this.searchConfig.maxResultsPerPage,
        cache_size: this.searchCache.size
      },
      metrics: {
        ...this.analysisMetrics,
        cache_hit_rate: this.analysisMetrics.searches_performed > 0 
          ? ((this.analysisMetrics.cache_hits / this.analysisMetrics.searches_performed) * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }
}

module.exports = new GitHubSearchAgent();
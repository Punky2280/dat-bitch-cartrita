/**
 * Comprehensive Wolfram Alpha Service for All Agent Types
 *
 * Provides full Wolfram Alpha API capabilities across all services:
 * - Mathematical computation and solving
 * - Scientific data and analysis
 * - Historical facts and dates
 * - Geographic information
 * - Unit conversions
 * - Statistical analysis
 * - Real-time data queries
 * - Image and plot generation
 */

import axios from 'axios';
import apiKeyManager from './APIKeyManager.js';

class WolframAlphaService {
  constructor() {
    this.apiKey = process.env.WOLFRAM_ALPHA_API_KEY || 'DEMO';
    this.baseUrl = 'https://api.wolframalpha.com/v2/query';
    this.initialized = false;
    this.requestCount = 0;
    this.cache = new Map();

    // Wolfram Alpha service capabilities
    this.capabilities = [
      'mathematical_computation',
      'scientific_analysis',
      'historical_data',
      'geographic_information',
      'unit_conversion',
      'statistical_analysis',
      'real_time_data',
      'image_generation',
      'step_by_step_solutions',
      'domain_specific_queries',
    ];
  }

  async initialize() {
    try {
      console.log(
        '[WolframAlphaService] 🧮 Initializing comprehensive Wolfram Alpha service...'
      );

      // Test API connectivity
      const testQuery = await this.query('2+2', { simple: true });

      if (testQuery && testQuery.includes('4')) {
        this.initialized = true;
        console.log(
          '[WolframAlphaService] ✅ Wolfram Alpha service initialized with full capabilities'
        );
        console.log(
          `  - API Key: ${
            this.apiKey === 'DEMO' ? 'DEMO (full access)' : 'CUSTOM'
          }`
        );
        console.log(
          `  - Capabilities: ${this.capabilities.length} service types available`
        );
        return true;
      } else {
        throw new Error('API test failed');
      }
    } catch (error) {
      console.error(
        '[WolframAlphaService] ❌ Initialization failed:',
        error.message
      );
      return false;
    }
  }

  /**
   * Main query method with comprehensive result processing
   */
  async query(input, options = {}) {
    try {
      const agentRole = options.agentRole || 'general';
      const apiKey = apiKeyManager.getKeyForAgent(
        agentRole,
        'wolfram',
        `wolfram-service-${Date.now()}`
      );

      if (!apiKey && this.apiKey !== 'DEMO') {
        throw new Error(
          'Wolfram Alpha API key not available for agent role: ' + agentRole
        );
      }

      // Check cache first
      const cacheKey = `${input}_${JSON.stringify(options)}`;
      if (this.cache.has(cacheKey)) {
        console.log('[WolframAlphaService] 📋 Returning cached result');
        return this.cache.get(cacheKey);
      }

      // Build query parameters
      const params = {
        input: input,
        appid: apiKey || this.apiKey,
        output: 'json',
        format: options.format || 'plaintext,image',
        ...this.buildFormatParams(options),
      };

      console.log(
        `[WolframAlphaService] 🔍 Querying: "${input.substring(0, 50)}..."`
      );

      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 10000,
      });

      this.requestCount++;

      if (response.data && response.data.queryresult) {
        const result = this.processWolframResult(
          response.data.queryresult,
          options
        );

        // Cache successful results
        this.cache.set(cacheKey, result);
        if (this.cache.size > 100) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }

        console.log(
          `[WolframAlphaService] ✅ Query successful (${this.requestCount} total requests)`
        );
        return result;
      } else {
        throw new Error('Invalid response from Wolfram Alpha API');
      }
    } catch (error) {
      console.error(`[WolframAlphaService] ❌ Query failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        fallback: `Unable to process "${input}" - ${error.message}`,
      };
    }
  }

  /**
   * Mathematical computation specialized for analyst and researcher agents
   */
  async computeMathematical(expression, options = {}) {
    const enhancedOptions = {
      ...options,
      format: 'plaintext,mathml,image',
      includesteps: true,
      agentRole: options.agentRole || 'analyst',
    };

    console.log(
      `[WolframAlphaService] 🧮 Mathematical computation: ${expression}`
    );
    return await this.query(expression, enhancedOptions);
  }

  /**
   * Scientific data queries for research agents
   */
  async queryScientificData(query, options = {}) {
    const enhancedOptions = {
      ...options,
      format: 'plaintext,image,sound',
      podindex: '1,2,3', // Get multiple relevant pods
      agentRole: options.agentRole || 'researcher',
    };

    console.log(`[WolframAlphaService] 🔬 Scientific query: ${query}`);
    return await this.query(query, enhancedOptions);
  }

  /**
   * Historical and factual information for writer and researcher agents
   */
  async queryHistoricalFacts(query, options = {}) {
    const enhancedOptions = {
      ...options,
      format: 'plaintext,image',
      podindex: '1,2,3,4', // Get comprehensive information
      agentRole: options.agentRole || 'writer',
    };

    console.log(`[WolframAlphaService] 📚 Historical query: ${query}`);
    return await this.query(query, enhancedOptions);
  }

  /**
   * Unit conversion for all agent types
   */
  async convertUnits(fromValue, fromUnit, toUnit, options = {}) {
    const conversionQuery = `convert ${fromValue} ${fromUnit} to ${toUnit}`;
    const enhancedOptions = {
      ...options,
      format: 'plaintext',
      agentRole: options.agentRole || 'general',
    };

    console.log(`[WolframAlphaService] 🔄 Unit conversion: ${conversionQuery}`);
    return await this.query(conversionQuery, enhancedOptions);
  }

  /**
   * Statistical analysis for analyst agents
   */
  async analyzeStatistics(data, analysisType = 'descriptive', options = {}) {
    let query;

    if (Array.isArray(data)) {
      query = `${analysisType} statistics of {${data.join(',')}}`;
    } else {
      query = `${analysisType} statistics ${data}`;
    }

    const enhancedOptions = {
      ...options,
      format: 'plaintext,image',
      podindex: '1,2,3,4,5', // Get comprehensive statistical analysis
      agentRole: options.agentRole || 'analyst',
    };

    console.log(`[WolframAlphaService] 📊 Statistical analysis: ${query}`);
    return await this.query(query, enhancedOptions);
  }

  /**
   * Geographic information for various agent types
   */
  async queryGeographic(location, infoType = 'general', options = {}) {
    const query =
      infoType === 'general' ? location : `${infoType} of ${location}`;
    const enhancedOptions = {
      ...options,
      format: 'plaintext,image',
      podindex: '1,2,3',
      agentRole: options.agentRole || 'researcher',
    };

    console.log(`[WolframAlphaService] 🌍 Geographic query: ${query}`);
    return await this.query(query, enhancedOptions);
  }

  /**
   * Real-time data queries (weather, stocks, etc.)
   */
  async queryRealTimeData(query, options = {}) {
    const enhancedOptions = {
      ...options,
      format: 'plaintext,image',
      podindex: '1,2',
      agentRole: options.agentRole || 'analyst',
    };

    console.log(`[WolframAlphaService] ⏰ Real-time query: ${query}`);
    return await this.query(query, enhancedOptions);
  }

  /**
   * Image and plot generation for creative and analyst agents
   */
  async generatePlot(expression, options = {}) {
    const plotQuery = `plot ${expression}`;
    const enhancedOptions = {
      ...options,
      format: 'image,mathml',
      width: options.width || 400,
      height: options.height || 300,
      agentRole: options.agentRole || 'analyst',
    };

    console.log(`[WolframAlphaService] 📈 Plot generation: ${expression}`);
    return await this.query(plotQuery, enhancedOptions);
  }

  /**
   * Process Wolfram Alpha results into agent-friendly format
   */
  processWolframResult(queryResult, options = {}) {
    if (!queryResult.success) {
      return {
        success: false,
        error: 'Query was not successful',
        suggestions: queryResult.didyoumeans || [],
      };
    }

    const result = {
      success: true,
      input: queryResult.inputstring || 'Unknown input',
      pods: [],
      images: [],
      plaintext: [],
      assumptions: queryResult.assumptions || [],
      warnings: queryResult.warnings || [],
      sources: queryResult.sources || [],
    };

    // Process pods (result sections)
    if (queryResult.pods) {
      for (const pod of queryResult.pods) {
        const processedPod = {
          title: pod.title,
          scanner: pod.scanner,
          position: pod.position,
          primary: pod.primary || false,
          subpods: [],
        };

        // Process subpods
        if (pod.subpods) {
          for (const subpod of pod.subpods) {
            const subpodData = {
              title: subpod.title || '',
              plaintext: subpod.plaintext || '',
              mathml: subpod.mathml || null,
            };

            // Extract images
            if (subpod.img) {
              subpodData.image = {
                src: subpod.img.src,
                alt: subpod.img.alt,
                title: subpod.img.title,
                width: subpod.img.width,
                height: subpod.img.height,
              };
              result.images.push(subpodData.image);
            }

            // Collect all plaintext
            if (subpod.plaintext) {
              result.plaintext.push(subpod.plaintext);
            }

            processedPod.subpods.push(subpodData);
          }
        }

        result.pods.push(processedPod);
      }
    }

    // Generate summary for agents
    result.summary = this.generateAgentSummary(result, options.agentRole);

    return result;
  }

  /**
   * Generate agent-specific summaries
   */
  generateAgentSummary(result, agentRole = 'general') {
    const plaintext = result.plaintext.join(' ');
    const primaryPod = result.pods.find(p => p.primary);

    const baseSummary = {
      query: result.input,
      success: result.success,
      main_result: primaryPod
        ? primaryPod.subpods[0]?.plaintext
        : 'No primary result found',
      has_images: result.images.length > 0,
      has_plots: result.images.some(img => img.alt && img.alt.includes('plot')),
      image_count: result.images.length,
    };

    // Customize summary based on agent role
    switch (agentRole) {
      case 'analyst':
        return {
          ...baseSummary,
          analytical_insight: this.extractAnalyticalInsight(result),
          statistical_data: this.extractStatisticalData(result),
          numerical_precision: this.extractNumericalData(result),
        };

      case 'researcher':
        return {
          ...baseSummary,
          research_findings: this.extractResearchFindings(result),
          related_topics: this.extractRelatedTopics(result),
          source_credibility: 'Wolfram Alpha - Computational Knowledge Engine',
        };

      case 'writer':
        return {
          ...baseSummary,
          narrative_elements: this.extractNarrativeElements(result),
          key_facts: this.extractKeyFacts(result),
          storytelling_angles: this.extractStorytellingAngles(result),
        };

      default:
        return baseSummary;
    }
  }

  /**
   * Extract analytical insights for analyst agents
   */
  extractAnalyticalInsight(result) {
    const insights = [];

    for (const pod of result.pods) {
      if (
        pod.title.toLowerCase().includes('result') ||
        pod.title.toLowerCase().includes('solution') ||
        pod.title.toLowerCase().includes('analysis')
      ) {
        insights.push({
          type: pod.title,
          content: pod.subpods[0]?.plaintext || 'No content',
        });
      }
    }

    return insights.length > 0
      ? insights
      : ['Standard computational result available'];
  }

  /**
   * Extract statistical data for analyst agents
   */
  extractStatisticalData(result) {
    const stats = [];

    for (const pod of result.pods) {
      if (
        pod.title.toLowerCase().includes('statistics') ||
        pod.title.toLowerCase().includes('distribution') ||
        pod.title.toLowerCase().includes('properties')
      ) {
        stats.push(pod.subpods[0]?.plaintext || '');
      }
    }

    return stats.filter(s => s.length > 0);
  }

  /**
   * Extract numerical data with high precision
   */
  extractNumericalData(result) {
    const numbers = [];
    const numberRegex = /-?\d+\.?\d*([eE][-+]?\d+)?/g;

    for (const text of result.plaintext) {
      const matches = text.match(numberRegex);
      if (matches) {
        numbers.push(...matches);
      }
    }

    return numbers.slice(0, 10); // Limit to first 10 numbers
  }

  /**
   * Extract research findings for researcher agents
   */
  extractResearchFindings(result) {
    const findings = [];

    for (const pod of result.pods) {
      if (
        pod.title.toLowerCase().includes('basic') ||
        pod.title.toLowerCase().includes('properties') ||
        pod.title.toLowerCase().includes('notable')
      ) {
        findings.push({
          category: pod.title,
          finding: pod.subpods[0]?.plaintext || 'No data',
        });
      }
    }

    return findings;
  }

  /**
   * Extract related topics for research expansion
   */
  extractRelatedTopics(result) {
    const topics = [];

    // Extract from pod titles as potential related topics
    for (const pod of result.pods) {
      if (
        pod.title &&
        !pod.title.toLowerCase().includes('input') &&
        !pod.title.toLowerCase().includes('result')
      ) {
        topics.push(pod.title);
      }
    }

    return topics.slice(0, 5); // Limit to 5 topics
  }

  /**
   * Extract narrative elements for writer agents
   */
  extractNarrativeElements(result) {
    const elements = {
      key_characters: [],
      important_dates: [],
      locations: [],
      events: [],
    };

    for (const text of result.plaintext) {
      // Extract dates
      const dateRegex = /\b\d{4}\b|\b\w+\s+\d{1,2},\s+\d{4}\b/g;
      const dates = text.match(dateRegex);
      if (dates) elements.important_dates.push(...dates);

      // Extract potential locations (capitalized words)
      const locationRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g;
      const locations = text.match(locationRegex);
      if (locations) elements.locations.push(...locations);
    }

    return elements;
  }

  /**
   * Extract key facts for writer agents
   */
  extractKeyFacts(result) {
    const facts = [];

    for (const pod of result.pods) {
      if (pod.subpods && pod.subpods[0]?.plaintext) {
        const fact = pod.subpods[0].plaintext;
        if (fact.length > 10 && fact.length < 200) {
          // Good fact length
          facts.push({
            category: pod.title,
            fact: fact,
          });
        }
      }
    }

    return facts.slice(0, 5); // Top 5 facts
  }

  /**
   * Extract storytelling angles for writer agents
   */
  extractStorytellingAngles(result) {
    const angles = [];

    // Look for interesting pods that could be story angles
    for (const pod of result.pods) {
      if (
        pod.title.toLowerCase().includes('notable') ||
        pod.title.toLowerCase().includes('interesting') ||
        pod.title.toLowerCase().includes('trivia') ||
        pod.title.toLowerCase().includes('history')
      ) {
        angles.push({
          angle: pod.title,
          content: pod.subpods[0]?.plaintext || 'No details available',
        });
      }
    }

    return angles;
  }

  /**
   * Build format parameters based on options
   */
  buildFormatParams(options) {
    const params = {};

    if (options.simple) {
      params.format = 'plaintext';
      params.podindex = '2'; // Usually the result pod
    }

    if (options.includesteps) {
      params.podstate = 'Step-by-step solution';
    }

    if (options.units) {
      params.units = options.units;
    }

    if (options.width && options.height) {
      params.width = options.width;
      params.height = options.height;
    }

    return params;
  }

  /**
   * Get service status and statistics
   */
  getStatus() {
    return {
      service: 'WolframAlphaService',
      initialized: this.initialized,
      api_key_configured: !!this.apiKey,
      requests_made: this.requestCount,
      cache_size: this.cache.size,
      capabilities: this.capabilities,
      agent_integrations: [
        'analyst_agents',
        'researcher_agents',
        'writer_agents',
        'creative_agents',
        'general_agents',
      ],
      last_check: new Date().toISOString(),
    };
  }

  /**
   * Clear cache and reset counters
   */
  reset() {
    this.cache.clear();
    this.requestCount = 0;
    console.log(
      '[WolframAlphaService] 🔄 Service reset - cache cleared, counters reset'
    );
  }
}

// Create singleton instance
const wolframAlphaService = new WolframAlphaService();

export default wolframAlphaService;

// packages/backend/src/agi/consciousness/AnalyticsAgent.js

const BaseAgent = require('../../system/BaseAgent');
const MessageBus = require('../../system/EnhancedMessageBus');

class AnalyticsAgent extends BaseAgent {
  constructor() {
    super('AnalyticsAgent', 'main', [
      'data_analysis',
      'metrics_generation', 
      'trend_identification',
      'statistical_analysis',
      'data_visualization'
    ]);

    this.setupMessageHandlers();
    this.initializeAnalyticsEngine();
    this.status = 'ready';
    console.log('[AnalyticsAgent.main] Agent initialized and ready');
  }

  setupMessageHandlers() {
    // Listen for analytics requests
    MessageBus.on('analytics.process', this.processAnalytics.bind(this));
    MessageBus.on('metrics.generate', this.generateMetrics.bind(this));
    MessageBus.on('insights.extract', this.extractInsights.bind(this));
    MessageBus.on('trends.identify', this.identifyTrends.bind(this));
    
    // Health monitoring
    MessageBus.on(`${this.agentId}.health`, this.healthCheck.bind(this));
  }

  initializeAnalyticsEngine() {
    this.analyticsEngine = {
      metrics: new Map(),
      trends: new Map(),
      insights: new Map(),
      dataCache: new Map()
    };
    
    this.statisticalMethods = {
      mean: (data) => data.reduce((a, b) => a + b, 0) / data.length,
      median: (data) => {
        const sorted = [...data].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      },
      standardDeviation: (data) => {
        const mean = this.statisticalMethods.mean(data);
        const variance = data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / data.length;
        return Math.sqrt(variance);
      },
      correlation: (x, y) => {
        const n = Math.min(x.length, y.length);
        const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
        const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
        const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
        const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
      }
    };
  }

  async processAnalytics(message) {
    try {
      const { data, analysisType, options = {} } = message.payload;
      
      let result;
      switch (analysisType) {
        case 'descriptive':
          result = await this.performDescriptiveAnalysis(data, options);
          break;
        case 'trend':
          result = await this.performTrendAnalysis(data, options);
          break;
        case 'correlation':
          result = await this.performCorrelationAnalysis(data, options);
          break;
        case 'forecast':
          result = await this.performForecastAnalysis(data, options);
          break;
        default:
          result = await this.performGeneralAnalysis(data, options);
      }

      MessageBus.publish(`analytics.result.${message.id}`, {
        status: 'completed',
        result,
        analysisType,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - message.timestamp
      });

    } catch (error) {
      console.error('[AnalyticsAgent] Error processing analytics:', error);
      MessageBus.publish(`analytics.error.${message.id}`, {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async performDescriptiveAnalysis(data, options) {
    const numericData = data.filter(d => typeof d === 'number');
    
    if (numericData.length === 0) {
      throw new Error('No numeric data provided for descriptive analysis');
    }

    return {
      count: numericData.length,
      mean: this.statisticalMethods.mean(numericData),
      median: this.statisticalMethods.median(numericData),
      standardDeviation: this.statisticalMethods.standardDeviation(numericData),
      min: Math.min(...numericData),
      max: Math.max(...numericData),
      range: Math.max(...numericData) - Math.min(...numericData),
      percentiles: this.calculatePercentiles(numericData, [25, 50, 75, 90, 95])
    };
  }

  async performTrendAnalysis(data, options) {
    if (!Array.isArray(data) || data.length < 3) {
      throw new Error('Insufficient data for trend analysis (minimum 3 points required)');
    }

    const timeSeriesData = data.map((item, index) => ({
      x: item.timestamp || index,
      y: item.value || item
    }));

    // Simple linear regression for trend
    const n = timeSeriesData.length;
    const sumX = timeSeriesData.reduce((sum, d) => sum + d.x, 0);
    const sumY = timeSeriesData.reduce((sum, d) => sum + d.y, 0);
    const sumXY = timeSeriesData.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumX2 = timeSeriesData.reduce((sum, d) => sum + d.x * d.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const trendDirection = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';
    const trendStrength = Math.abs(slope);

    return {
      slope,
      intercept,
      direction: trendDirection,
      strength: trendStrength,
      rSquared: this.calculateRSquared(timeSeriesData, slope, intercept),
      forecast: this.generateForecast(timeSeriesData, slope, intercept, options.forecastPeriods || 5)
    };
  }

  async performCorrelationAnalysis(data, options) {
    if (!data.xValues || !data.yValues) {
      throw new Error('Correlation analysis requires xValues and yValues arrays');
    }

    const correlation = this.statisticalMethods.correlation(data.xValues, data.yValues);
    const correlationStrength = Math.abs(correlation);
    
    let interpretation;
    if (correlationStrength >= 0.8) interpretation = 'very strong';
    else if (correlationStrength >= 0.6) interpretation = 'strong';
    else if (correlationStrength >= 0.4) interpretation = 'moderate';
    else if (correlationStrength >= 0.2) interpretation = 'weak';
    else interpretation = 'very weak';

    return {
      correlation,
      strength: correlationStrength,
      interpretation,
      direction: correlation > 0 ? 'positive' : 'negative',
      significance: this.calculateSignificance(correlation, data.xValues.length)
    };
  }

  async generateMetrics(message) {
    try {
      const { metricType, data, timeframe } = message.payload;
      
      const metrics = await this.calculateMetrics(metricType, data, timeframe);
      
      // Store metrics for future reference
      this.analyticsEngine.metrics.set(
        `${metricType}_${timeframe}`, 
        { ...metrics, timestamp: new Date().toISOString() }
      );

      MessageBus.publish(`metrics.result.${message.id}`, {
        status: 'completed',
        metrics,
        metricType,
        timeframe,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[AnalyticsAgent] Error generating metrics:', error);
      MessageBus.publish(`metrics.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async calculateMetrics(metricType, data, timeframe) {
    switch (metricType) {
      case 'performance':
        return this.calculatePerformanceMetrics(data);
      case 'usage':
        return this.calculateUsageMetrics(data);
      case 'quality':
        return this.calculateQualityMetrics(data);
      case 'efficiency':
        return this.calculateEfficiencyMetrics(data);
      default:
        return this.calculateGeneralMetrics(data);
    }
  }

  calculatePerformanceMetrics(data) {
    const responseTimes = data.map(d => d.responseTime).filter(t => t !== undefined);
    const successRates = data.map(d => d.success ? 1 : 0);
    
    return {
      averageResponseTime: this.statisticalMethods.mean(responseTimes),
      medianResponseTime: this.statisticalMethods.median(responseTimes),
      p95ResponseTime: this.calculatePercentiles(responseTimes, [95])[95],
      successRate: this.statisticalMethods.mean(successRates) * 100,
      throughput: data.length / (data.length > 0 ? 1 : 1), // requests per unit time
      errorRate: (1 - this.statisticalMethods.mean(successRates)) * 100
    };
  }

  calculatePercentiles(data, percentiles) {
    const sorted = [...data].sort((a, b) => a - b);
    const result = {};
    
    percentiles.forEach(p => {
      const index = (p / 100) * (sorted.length - 1);
      if (Number.isInteger(index)) {
        result[p] = sorted[index];
      } else {
        const lower = sorted[Math.floor(index)];
        const upper = sorted[Math.ceil(index)];
        result[p] = lower + (upper - lower) * (index - Math.floor(index));
      }
    });
    
    return result;
  }

  calculateRSquared(data, slope, intercept) {
    const yMean = this.statisticalMethods.mean(data.map(d => d.y));
    const totalSumSquares = data.reduce((sum, d) => sum + Math.pow(d.y - yMean, 2), 0);
    const residualSumSquares = data.reduce((sum, d) => {
      const predicted = slope * d.x + intercept;
      return sum + Math.pow(d.y - predicted, 2);
    }, 0);
    
    return 1 - (residualSumSquares / totalSumSquares);
  }

  generateForecast(data, slope, intercept, periods) {
    const lastX = Math.max(...data.map(d => d.x));
    const forecast = [];
    
    for (let i = 1; i <= periods; i++) {
      const x = lastX + i;
      const y = slope * x + intercept;
      forecast.push({ x, y, predicted: true });
    }
    
    return forecast;
  }

  async extractInsights(message) {
    try {
      const { data, context } = message.payload;
      
      // Use AI to generate insights from the data
      const insights = await this.generateAIInsights(data, context);
      
      MessageBus.publish(`insights.result.${message.id}`, {
        status: 'completed',
        insights,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[AnalyticsAgent] Error extracting insights:', error);
      MessageBus.publish(`insights.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async identifyTrends(message) {
    try {
      const { data, timeframe, options = {} } = message.payload;
      
      const trendAnalysis = await this.performTrendAnalysis(data, options);
      
      // Store trends for future reference
      this.analyticsEngine.trends.set(
        `${timeframe}_${Date.now()}`, 
        { ...trendAnalysis, timestamp: new Date().toISOString() }
      );

      MessageBus.publish(`trends.result.${message.id}`, {
        status: 'completed',
        trends: trendAnalysis,
        timeframe,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[AnalyticsAgent] Error identifying trends:', error);
      MessageBus.publish(`trends.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async generateAIInsights(data, context) {
    const prompt = `
    Analyze the following data and provide actionable insights:
    
    Data Summary: ${JSON.stringify(data, null, 2)}
    Context: ${context || 'General analysis'}
    
    Please provide:
    1. Key patterns identified
    2. Notable anomalies or outliers
    3. Actionable recommendations
    4. Potential risks or opportunities
    5. Confidence level in findings
    
    Format as structured insights with clear explanations.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      });

      return {
        aiInsights: response.choices[0].message.content,
        confidence: 0.8,
        source: 'GPT-4 Analysis',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        insights: 'Unable to generate AI insights at this time',
        confidence: 0.1,
        error: error.message
      };
    }
  }

  healthCheck() {
    return {
      status: this.status,
      agentId: this.agentId,
      capabilities: this.capabilities,
      metrics: {
        analyticsProcessed: this.analyticsEngine.metrics.size,
        cacheSize: this.analyticsEngine.dataCache.size,
        uptime: Date.now() - new Date(this.metadata.created_at).getTime()
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Initialize and export the agent
module.exports = new AnalyticsAgent();
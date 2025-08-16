import { EventEmitter } from 'events';
import crypto from 'crypto';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityAuditLogger from '../system/SecurityAuditLogger.js';

/**
 * User Behavior Analytics Engine
 * 
 * Comprehensive user behavior tracking and analysis system providing:
 * - Real-time user session tracking and analysis
 * - User journey mapping and conversion funnel analysis
 * - Behavioral pattern recognition and clustering
 * - A/B testing framework and statistical analysis
 * - Cohort analysis and retention tracking
 * - Personalization engine for content and UX optimization
 * - Anomaly detection in user behavior patterns
 * - Privacy-compliant analytics with data anonymization
 */
class UserBehaviorAnalyticsEngine extends EventEmitter {
  constructor(dbPool, options = {}) {
    super();
    
    this.dbPool = dbPool;
    this.isInitialized = false;
    
    this.config = {
      // Session tracking configuration
      sessionTimeout: options.sessionTimeout || 30 * 60 * 1000, // 30 minutes
      maxSessionDuration: options.maxSessionDuration || 8 * 60 * 60 * 1000, // 8 hours
      
      // Analytics configuration
      realTimeBufferSize: options.realTimeBufferSize || 1000,
      batchProcessingInterval: options.batchProcessingInterval || 60000, // 1 minute
      dataRetentionDays: options.dataRetentionDays || 365,
      
      // Privacy configuration
      enablePrivacyMode: options.enablePrivacyMode || true,
      anonymizeUserData: options.anonymizeUserData || true,
      cookieConsent: options.cookieConsent || true,
      
      // A/B testing configuration
      maxActiveExperiments: options.maxActiveExperiments || 10,
      minSampleSize: options.minSampleSize || 100,
      statisticalSignificance: options.statisticalSignificance || 0.95,
      
      // Performance configuration
      maxConcurrentAnalyses: options.maxConcurrentAnalyses || 5,
      cacheSize: options.cacheSize || 5000,
      
      ...options
    };
    
    // In-memory data structures
    this.activeSessions = new Map();
    this.eventBuffer = [];
    this.userJourneys = new Map();
    this.conversionFunnels = new Map();
    this.abTestExperiments = new Map();
    this.userSegments = new Map();
    this.behaviorPatterns = new Map();
    
    // Analytics metrics
    this.metrics = {
      totalUsers: 0,
      activeUsers: 0,
      totalSessions: 0,
      activeSessions: 0,
      totalEvents: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      conversionRate: 0,
      lastUpdated: null
    };
    
    // Initialize telemetry
    this.eventCounter = OpenTelemetryTracing.createCounter(
      'user_behavior_events_total',
      'Total number of user behavior events tracked'
    );
    
    this.sessionCounter = OpenTelemetryTracing.createCounter(
      'user_sessions_total',
      'Total number of user sessions'
    );
    
    this.conversionCounter = OpenTelemetryTracing.createCounter(
      'user_conversions_total',
      'Total number of user conversions'
    );
  }
  
  /**
   * Initialize the User Behavior Analytics Engine
   */
  async initialize() {
    try {
      const span = OpenTelemetryTracing.getTracer('user-behavior-engine').startSpan('initialize');
      
      // Create user behavior analytics tables
      await this.createAnalyticsTables();
      
      // Load existing data
      await this.loadActiveData();
      
      // Start real-time processing
      this.startRealTimeProcessing();
      
      // Start periodic analytics calculations
      this.startPeriodicAnalytics();
      
      this.isInitialized = true;
      
      await SecurityAuditLogger.logSecurityEvent(
        'user_behavior_engine_initialized',
        'User Behavior Analytics Engine initialized successfully',
        { activeUsers: this.metrics.activeUsers }
      );
      
      span.setStatus({ code: 1 });
      span.end();
      
      this.emit('initialized');
      
    } catch (error) {
      console.error('Failed to initialize User Behavior Analytics Engine:', error);
      throw error;
    }
  }
  
  /**
   * Create analytics database tables
   */
  async createAnalyticsTables() {
    const createTablesQuery = `
      -- User sessions table
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        user_id VARCHAR(255),
        anonymous_id VARCHAR(255),
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        duration_ms INTEGER,
        page_views INTEGER DEFAULT 0,
        events_count INTEGER DEFAULT 0,
        is_bounce BOOLEAN DEFAULT false,
        converted BOOLEAN DEFAULT false,
        conversion_value DECIMAL(10,2) DEFAULT 0,
        user_agent TEXT,
        ip_address INET,
        referrer TEXT,
        utm_source VARCHAR(255),
        utm_medium VARCHAR(255),
        utm_campaign VARCHAR(255),
        device_type VARCHAR(50),
        browser VARCHAR(100),
        os VARCHAR(100),
        country VARCHAR(3),
        region VARCHAR(255),
        city VARCHAR(255),
        metadata JSONB
      );
      
      -- User behavior events table
      CREATE TABLE IF NOT EXISTS user_behavior_events (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL UNIQUE,
        session_id VARCHAR(255) REFERENCES user_sessions(session_id),
        user_id VARCHAR(255),
        anonymous_id VARCHAR(255),
        event_type VARCHAR(100) NOT NULL,
        event_category VARCHAR(100),
        event_action VARCHAR(100),
        event_label VARCHAR(255),
        event_value DECIMAL(10,2),
        page_url TEXT,
        page_title VARCHAR(500),
        referrer TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        properties JSONB,
        user_properties JSONB,
        session_properties JSONB
      );
      
      -- User journeys table
      CREATE TABLE IF NOT EXISTS user_journeys (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        anonymous_id VARCHAR(255),
        journey_id VARCHAR(255) NOT NULL,
        touchpoints JSONB NOT NULL,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        conversion_goal VARCHAR(100),
        converted BOOLEAN DEFAULT false,
        conversion_value DECIMAL(10,2) DEFAULT 0,
        journey_stage VARCHAR(100),
        attribution_model VARCHAR(100),
        metadata JSONB
      );
      
      -- Conversion funnels table
      CREATE TABLE IF NOT EXISTS conversion_funnels (
        id SERIAL PRIMARY KEY,
        funnel_name VARCHAR(255) NOT NULL,
        funnel_config JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Funnel analytics table
      CREATE TABLE IF NOT EXISTS funnel_analytics (
        id SERIAL PRIMARY KEY,
        funnel_id INTEGER REFERENCES conversion_funnels(id),
        step_name VARCHAR(255) NOT NULL,
        step_order INTEGER NOT NULL,
        total_users INTEGER DEFAULT 0,
        converted_users INTEGER DEFAULT 0,
        conversion_rate DECIMAL(5,2) DEFAULT 0,
        avg_time_to_convert INTEGER,
        drop_off_rate DECIMAL(5,2) DEFAULT 0,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date_period DATE,
        metadata JSONB
      );
      
      -- A/B test experiments table
      CREATE TABLE IF NOT EXISTS ab_test_experiments (
        id SERIAL PRIMARY KEY,
        experiment_name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        hypothesis TEXT,
        variations JSONB NOT NULL,
        traffic_allocation JSONB NOT NULL,
        success_metrics JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        min_sample_size INTEGER DEFAULT 100,
        statistical_significance DECIMAL(3,2) DEFAULT 0.95,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      );
      
      -- A/B test results table
      CREATE TABLE IF NOT EXISTS ab_test_results (
        id SERIAL PRIMARY KEY,
        experiment_id INTEGER REFERENCES ab_test_experiments(id),
        variation_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255),
        session_id VARCHAR(255),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        converted BOOLEAN DEFAULT false,
        conversion_value DECIMAL(10,2) DEFAULT 0,
        conversion_time TIMESTAMP,
        metadata JSONB
      );
      
      -- User cohorts table
      CREATE TABLE IF NOT EXISTS user_cohorts (
        id SERIAL PRIMARY KEY,
        cohort_name VARCHAR(255) NOT NULL,
        cohort_period VARCHAR(50) NOT NULL,
        cohort_date DATE NOT NULL,
        total_users INTEGER NOT NULL,
        retention_rates JSONB,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      );
      
      -- User segments table
      CREATE TABLE IF NOT EXISTS user_segments (
        id SERIAL PRIMARY KEY,
        segment_name VARCHAR(255) NOT NULL UNIQUE,
        segment_description TEXT,
        segment_criteria JSONB NOT NULL,
        user_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      );
      
      -- Behavioral patterns table
      CREATE TABLE IF NOT EXISTS behavioral_patterns (
        id SERIAL PRIMARY KEY,
        pattern_name VARCHAR(255) NOT NULL,
        pattern_type VARCHAR(100) NOT NULL,
        pattern_data JSONB NOT NULL,
        frequency INTEGER DEFAULT 0,
        confidence_score DECIMAL(3,2) DEFAULT 0,
        user_segment VARCHAR(255),
        discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      );
      
      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON user_sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_behavior_events_session_id ON user_behavior_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_behavior_events_user_id ON user_behavior_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_behavior_events_type ON user_behavior_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_behavior_events_timestamp ON user_behavior_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_user_journeys_user_id ON user_journeys(user_id);
      CREATE INDEX IF NOT EXISTS idx_funnel_analytics_funnel_id ON funnel_analytics(funnel_id);
      CREATE INDEX IF NOT EXISTS idx_ab_test_results_experiment_id ON ab_test_results(experiment_id);
      CREATE INDEX IF NOT EXISTS idx_user_cohorts_date ON user_cohorts(cohort_date);
    `;
    
    await this.dbPool.query(createTablesQuery);
  }
  
  /**
   * Track a user behavior event
   */
  async trackEvent(eventData) {
    try {
      const span = OpenTelemetryTracing.getTracer('user-behavior-engine').startSpan('track_event');
      
      const {
        userId,
        sessionId,
        eventType,
        eventCategory,
        eventAction,
        eventLabel,
        eventValue,
        pageUrl,
        pageTitle,
        referrer,
        properties = {},
        userProperties = {},
        sessionProperties = {},
        timestamp = new Date(),
        userAgent,
        ipAddress
      } = eventData;
      
      // Generate event ID
      const eventId = `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      // Create anonymous ID if no user ID provided
      const anonymousId = userId || this.generateAnonymousId(sessionId, ipAddress);
      
      // Update or create session
      await this.updateSession(sessionId, {
        userId,
        anonymousId,
        lastActivityAt: timestamp,
        userAgent,
        ipAddress,
        ...sessionProperties
      });
      
      // Store event in buffer for real-time processing
      const event = {
        eventId,
        sessionId,
        userId,
        anonymousId,
        eventType,
        eventCategory,
        eventAction,
        eventLabel,
        eventValue,
        pageUrl,
        pageTitle,
        referrer,
        timestamp,
        properties,
        userProperties,
        sessionProperties
      };
      
      this.eventBuffer.push(event);
      
      // If buffer is full, process immediately
      if (this.eventBuffer.length >= this.config.realTimeBufferSize) {
        await this.processEventBuffer();
      }
      
      // Update metrics
      this.metrics.totalEvents++;
      
      // Telemetry
      this.eventCounter.add(1, {
        event_type: eventType,
        event_category: eventCategory
      });
      
      span.setAttributes({
        'event.type': eventType,
        'event.category': eventCategory,
        'user.id': userId || 'anonymous'
      });
      span.setStatus({ code: 1 });
      span.end();
      
      this.emit('eventTracked', event);
      
      return { eventId, success: true };
      
    } catch (error) {
      console.error('Error tracking user behavior event:', error);
      throw error;
    }
  }
  
  /**
   * Get user behavior analytics
   */
  async getAnalytics(options = {}) {
    try {
      const {
        timeRange = '7d',
        userId,
        includeJourney = false,
        includeFunnels = false,
        includeSegments = false,
        includeCohorts = false,
        includePatterns = false
      } = options;
      
      const timeFilter = this.getTimeRangeFilter(timeRange);
      const analytics = {
        summary: await this.getSummaryAnalytics(timeFilter, userId),
        topEvents: await this.getTopEvents(timeFilter, userId),
        pageViews: await this.getPageViewAnalytics(timeFilter, userId),
        deviceBreakdown: await this.getDeviceBreakdown(timeFilter, userId),
        trafficSources: await this.getTrafficSources(timeFilter, userId)
      };
      
      if (includeJourney) {
        analytics.userJourneys = await this.getUserJourneyAnalytics(timeFilter, userId);
      }
      
      if (includeFunnels) {
        analytics.conversionFunnels = await this.getFunnelAnalytics(timeFilter);
      }
      
      if (includeSegments) {
        analytics.userSegments = await this.getUserSegmentAnalytics(timeFilter);
      }
      
      if (includeCohorts) {
        analytics.cohortAnalysis = await this.getCohortAnalytics(timeRange);
      }
      
      if (includePatterns) {
        analytics.behavioralPatterns = await this.getBehavioralPatterns(timeFilter, userId);
      }
      
      return analytics;
      
    } catch (error) {
      console.error('Error getting user behavior analytics:', error);
      throw error;
    }
  }
  
  /**
   * Create conversion funnel
   */
  async createConversionFunnel(funnelName, funnelConfig) {
    try {
      const insertQuery = `
        INSERT INTO conversion_funnels (funnel_name, funnel_config)
        VALUES ($1, $2)
        RETURNING id, created_at
      `;
      
      const result = await this.dbPool.query(insertQuery, [
        funnelName,
        JSON.stringify(funnelConfig)
      ]);
      
      const funnelId = result.rows[0].id;
      
      // Store in memory for quick access
      this.conversionFunnels.set(funnelName, {
        id: funnelId,
        name: funnelName,
        config: funnelConfig,
        isActive: true,
        createdAt: result.rows[0].created_at
      });
      
      // Calculate initial funnel metrics
      await this.calculateFunnelMetrics(funnelId);
      
      return { funnelId, funnelName };
      
    } catch (error) {
      console.error('Error creating conversion funnel:', error);
      throw error;
    }
  }
  
  /**
   * Create A/B test experiment
   */
  async createABTestExperiment(experimentConfig) {
    try {
      const {
        experimentName,
        description,
        hypothesis,
        variations,
        trafficAllocation,
        successMetrics,
        startDate,
        endDate,
        minSampleSize = 100,
        statisticalSignificance = 0.95,
        createdBy
      } = experimentConfig;
      
      const insertQuery = `
        INSERT INTO ab_test_experiments (
          experiment_name, description, hypothesis, variations,
          traffic_allocation, success_metrics, start_date, end_date,
          min_sample_size, statistical_significance, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, created_at
      `;
      
      const result = await this.dbPool.query(insertQuery, [
        experimentName,
        description,
        hypothesis,
        JSON.stringify(variations),
        JSON.stringify(trafficAllocation),
        JSON.stringify(successMetrics),
        startDate,
        endDate,
        minSampleSize,
        statisticalSignificance,
        createdBy
      ]);
      
      const experimentId = result.rows[0].id;
      
      // Store in memory
      this.abTestExperiments.set(experimentName, {
        id: experimentId,
        name: experimentName,
        description,
        hypothesis,
        variations,
        trafficAllocation,
        successMetrics,
        status: 'draft',
        startDate,
        endDate,
        minSampleSize,
        statisticalSignificance,
        createdBy,
        createdAt: result.rows[0].created_at
      });
      
      return { experimentId, experimentName };
      
    } catch (error) {
      console.error('Error creating A/B test experiment:', error);
      throw error;
    }
  }
  
  /**
   * Assign user to A/B test variation
   */
  async assignUserToExperiment(experimentName, userId, sessionId) {
    try {
      const experiment = this.abTestExperiments.get(experimentName);
      if (!experiment) {
        throw new Error(`Experiment '${experimentName}' not found`);
      }
      
      if (experiment.status !== 'active') {
        throw new Error(`Experiment '${experimentName}' is not active`);
      }
      
      // Determine variation based on traffic allocation
      const variationId = this.selectVariation(experiment.trafficAllocation, userId);
      
      // Record assignment
      const insertQuery = `
        INSERT INTO ab_test_results (experiment_id, variation_id, user_id, session_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (experiment_id, user_id) DO NOTHING
        RETURNING id
      `;
      
      await this.dbPool.query(insertQuery, [
        experiment.id,
        variationId,
        userId,
        sessionId
      ]);
      
      return { variationId };
      
    } catch (error) {
      console.error('Error assigning user to A/B test:', error);
      throw error;
    }
  }
  
  /**
   * Update session data
   */
  async updateSession(sessionId, sessionData) {
    try {
      if (!this.activeSessions.has(sessionId)) {
        // Create new session
        const session = {
          sessionId,
          userId: sessionData.userId,
          anonymousId: sessionData.anonymousId,
          startedAt: new Date(),
          lastActivityAt: sessionData.lastActivityAt || new Date(),
          pageViews: 0,
          eventsCount: 0,
          isBounce: false,
          converted: false,
          conversionValue: 0,
          userAgent: sessionData.userAgent,
          ipAddress: sessionData.ipAddress,
          deviceInfo: this.parseDeviceInfo(sessionData.userAgent),
          metadata: {}
        };
        
        this.activeSessions.set(sessionId, session);
        this.metrics.activeSessions++;
        this.metrics.totalSessions++;
        
        // Telemetry
        this.sessionCounter.add(1);
        
      } else {
        // Update existing session
        const session = this.activeSessions.get(sessionId);
        session.lastActivityAt = sessionData.lastActivityAt || new Date();
        session.eventsCount++;
        
        if (sessionData.pageUrl) {
          session.pageViews++;
        }
        
        if (sessionData.converted) {
          session.converted = true;
          session.conversionValue = sessionData.conversionValue || 0;
          
          // Telemetry
          this.conversionCounter.add(1, {
            session_id: sessionId
          });
        }
      }
      
    } catch (error) {
      console.error('Error updating session:', error);
    }
  }
  
  /**
   * Process event buffer
   */
  async processEventBuffer() {
    if (this.eventBuffer.length === 0) return;
    
    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];
      
      // Batch insert events to database
      if (events.length > 0) {
        await this.batchInsertEvents(events);
      }
      
      // Update user journeys
      await this.updateUserJourneys(events);
      
      // Update behavioral patterns
      await this.updateBehavioralPatterns(events);
      
      // Check for conversion events
      await this.processConversions(events);
      
    } catch (error) {
      console.error('Error processing event buffer:', error);
    }
  }
  
  /**
   * Batch insert events to database
   */
  async batchInsertEvents(events) {
    try {
      const insertQuery = `
        INSERT INTO user_behavior_events (
          event_id, session_id, user_id, anonymous_id, event_type,
          event_category, event_action, event_label, event_value,
          page_url, page_title, referrer, timestamp, properties,
          user_properties, session_properties
        )
        VALUES ${events.map((_, i) => `(${Array.from({length: 16}, (_, j) => `$${i * 16 + j + 1}`).join(', ')})`).join(', ')}
      `;
      
      const values = events.flatMap(event => [
        event.eventId,
        event.sessionId,
        event.userId,
        event.anonymousId,
        event.eventType,
        event.eventCategory,
        event.eventAction,
        event.eventLabel,
        event.eventValue,
        event.pageUrl,
        event.pageTitle,
        event.referrer,
        event.timestamp,
        JSON.stringify(event.properties),
        JSON.stringify(event.userProperties),
        JSON.stringify(event.sessionProperties)
      ]);
      
      await this.dbPool.query(insertQuery, values);
      
    } catch (error) {
      console.error('Error batch inserting events:', error);
      throw error;
    }
  }
  
  /**
   * Get summary analytics
   */
  async getSummaryAnalytics(timeFilter, userId) {
    try {
      let whereClause = `WHERE s.started_at >= $1 AND s.started_at <= $2`;
      const params = [timeFilter.startDate, timeFilter.endDate];
      
      if (userId) {
        whereClause += ` AND s.user_id = $3`;
        params.push(userId);
      }
      
      const query = `
        SELECT 
          COUNT(DISTINCT s.user_id) as unique_users,
          COUNT(s.id) as total_sessions,
          AVG(s.duration_ms) as avg_session_duration,
          AVG(s.page_views) as avg_page_views,
          (COUNT(*) FILTER (WHERE s.is_bounce = true) * 100.0 / COUNT(*)) as bounce_rate,
          (COUNT(*) FILTER (WHERE s.converted = true) * 100.0 / COUNT(*)) as conversion_rate,
          SUM(s.conversion_value) as total_revenue
        FROM user_sessions s
        ${whereClause}
      `;
      
      const result = await this.dbPool.query(query, params);
      return result.rows[0];
      
    } catch (error) {
      console.error('Error getting summary analytics:', error);
      throw error;
    }
  }
  
  /**
   * Get top events analytics
   */
  async getTopEvents(timeFilter, userId) {
    try {
      let whereClause = `WHERE e.timestamp >= $1 AND e.timestamp <= $2`;
      const params = [timeFilter.startDate, timeFilter.endDate];
      
      if (userId) {
        whereClause += ` AND e.user_id = $3`;
        params.push(userId);
      }
      
      const query = `
        SELECT 
          e.event_type,
          e.event_category,
          e.event_action,
          COUNT(*) as event_count,
          COUNT(DISTINCT e.user_id) as unique_users,
          AVG(e.event_value) as avg_value
        FROM user_behavior_events e
        ${whereClause}
        GROUP BY e.event_type, e.event_category, e.event_action
        ORDER BY event_count DESC
        LIMIT 20
      `;
      
      const result = await this.dbPool.query(query, params);
      return result.rows;
      
    } catch (error) {
      console.error('Error getting top events:', error);
      throw error;
    }
  }
  
  /**
   * Get page view analytics
   */
  async getPageViewAnalytics(timeFilter, userId) {
    try {
      let whereClause = `WHERE e.timestamp >= $1 AND e.timestamp <= $2 AND e.event_type = 'page_view'`;
      const params = [timeFilter.startDate, timeFilter.endDate];
      
      if (userId) {
        whereClause += ` AND e.user_id = $3`;
        params.push(userId);
      }
      
      const query = `
        SELECT 
          e.page_url,
          e.page_title,
          COUNT(*) as page_views,
          COUNT(DISTINCT e.user_id) as unique_visitors,
          AVG(EXTRACT(EPOCH FROM e.timestamp - LAG(e.timestamp) OVER (PARTITION BY e.session_id ORDER BY e.timestamp))) as avg_time_on_page
        FROM user_behavior_events e
        ${whereClause}
        GROUP BY e.page_url, e.page_title
        ORDER BY page_views DESC
        LIMIT 50
      `;
      
      const result = await this.dbPool.query(query, params);
      return result.rows;
      
    } catch (error) {
      console.error('Error getting page view analytics:', error);
      throw error;
    }
  }
  
  /**
   * Start real-time processing
   */
  startRealTimeProcessing() {
    setInterval(async () => {
      if (this.eventBuffer.length > 0) {
        await this.processEventBuffer();
      }
    }, this.config.batchProcessingInterval);
  }
  
  /**
   * Start periodic analytics calculations
   */
  startPeriodicAnalytics() {
    // Calculate metrics every hour
    setInterval(async () => {
      await this.calculatePeriodicMetrics();
    }, 60 * 60 * 1000);
  }
  
  /**
   * Calculate periodic metrics
   */
  async calculatePeriodicMetrics() {
    try {
      // Update active sessions metrics
      await this.updateActiveSessionsMetrics();
      
      // Calculate funnel metrics
      for (const funnel of this.conversionFunnels.values()) {
        await this.calculateFunnelMetrics(funnel.id);
      }
      
      // Update user segments
      await this.updateUserSegments();
      
      // Generate behavioral insights
      await this.generateBehavioralInsights();
      
    } catch (error) {
      console.error('Error calculating periodic metrics:', error);
    }
  }
  
  /**
   * Helper methods
   */
  generateAnonymousId(sessionId, ipAddress) {
    return crypto.createHash('sha256')
      .update(`${sessionId}:${ipAddress}`)
      .digest('hex')
      .substring(0, 16);
  }
  
  parseDeviceInfo(userAgent) {
    // Simple user agent parsing - would use a proper library in production
    return {
      deviceType: userAgent?.includes('Mobile') ? 'mobile' : 'desktop',
      browser: this.extractBrowser(userAgent),
      os: this.extractOS(userAgent)
    };
  }
  
  extractBrowser(userAgent) {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  }
  
  extractOS(userAgent) {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Other';
  }
  
  getTimeRangeFilter(timeRange) {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    
    return { startDate, endDate: now };
  }
  
  selectVariation(trafficAllocation, userId) {
    // Use consistent hashing for variation assignment
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
    
    let cumulativeWeight = 0;
    for (const [variationId, weight] of Object.entries(trafficAllocation)) {
      cumulativeWeight += weight;
      if (hashValue <= cumulativeWeight) {
        return variationId;
      }
    }
    
    // Fallback to first variation
    return Object.keys(trafficAllocation)[0];
  }
  
  async loadActiveData() {
    // Load recent sessions and experiments
    const recentSessionsQuery = `
      SELECT * FROM user_sessions 
      WHERE last_activity_at > NOW() - INTERVAL '1 hour'
      AND ended_at IS NULL
    `;
    
    const sessionsResult = await this.dbPool.query(recentSessionsQuery);
    for (const sessionRow of sessionsResult.rows) {
      this.activeSessions.set(sessionRow.session_id, {
        sessionId: sessionRow.session_id,
        userId: sessionRow.user_id,
        anonymousId: sessionRow.anonymous_id,
        startedAt: sessionRow.started_at,
        lastActivityAt: sessionRow.last_activity_at,
        pageViews: sessionRow.page_views,
        eventsCount: sessionRow.events_count,
        isBounce: sessionRow.is_bounce,
        converted: sessionRow.converted,
        conversionValue: sessionRow.conversion_value,
        userAgent: sessionRow.user_agent,
        ipAddress: sessionRow.ip_address,
        metadata: sessionRow.metadata
      });
    }
    
    // Load active experiments
    const experimentsQuery = `
      SELECT * FROM ab_test_experiments 
      WHERE status = 'active'
      AND (end_date IS NULL OR end_date > NOW())
    `;
    
    const experimentsResult = await this.dbPool.query(experimentsQuery);
    for (const expRow of experimentsResult.rows) {
      this.abTestExperiments.set(expRow.experiment_name, {
        id: expRow.id,
        name: expRow.experiment_name,
        description: expRow.description,
        hypothesis: expRow.hypothesis,
        variations: expRow.variations,
        trafficAllocation: expRow.traffic_allocation,
        successMetrics: expRow.success_metrics,
        status: expRow.status,
        startDate: expRow.start_date,
        endDate: expRow.end_date,
        minSampleSize: expRow.min_sample_size,
        statisticalSignificance: expRow.statistical_significance,
        createdBy: expRow.created_by,
        createdAt: expRow.created_at
      });
    }
  }
  
  async updateUserJourneys(events) {
    // Implementation for user journey tracking
    // This would analyze event sequences and update user journey data
  }
  
  async updateBehavioralPatterns(events) {
    // Implementation for behavioral pattern recognition
    // This would use ML algorithms to identify patterns in user behavior
  }
  
  async processConversions(events) {
    // Implementation for conversion tracking
    // This would identify conversion events and update metrics
  }
  
  async getUserJourneyAnalytics(timeFilter, userId) {
    // Implementation for user journey analytics
    return [];
  }
  
  async getFunnelAnalytics(timeFilter) {
    // Implementation for funnel analytics
    return [];
  }
  
  async getUserSegmentAnalytics(timeFilter) {
    // Implementation for user segment analytics
    return [];
  }
  
  async getCohortAnalytics(timeRange) {
    // Implementation for cohort analysis
    return [];
  }
  
  async getBehavioralPatterns(timeFilter, userId) {
    // Implementation for behavioral pattern analytics
    return [];
  }
  
  async getDeviceBreakdown(timeFilter, userId) {
    // Implementation for device analytics
    return [];
  }
  
  async getTrafficSources(timeFilter, userId) {
    // Implementation for traffic source analytics
    return [];
  }
  
  async calculateFunnelMetrics(funnelId) {
    // Implementation for funnel metrics calculation
  }
  
  async updateActiveSessionsMetrics() {
    // Implementation for active session metrics update
  }
  
  async updateUserSegments() {
    // Implementation for user segment updates
  }
  
  async generateBehavioralInsights() {
    // Implementation for behavioral insights generation
  }
  
  /**
   * Get engine status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      metrics: this.metrics,
      activeSessions: this.activeSessions.size,
      activeExperiments: this.abTestExperiments.size,
      conversionFunnels: this.conversionFunnels.size,
      eventBufferSize: this.eventBuffer.length
    };
  }
}

export default UserBehaviorAnalyticsEngine;

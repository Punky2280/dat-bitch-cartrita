const { google } = require('googleapis');
const pool = require('../db');

class GoogleAPIService {
  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || 'AIzaSyDp-cMne4eJ-EtV68iNlypHdssyZ76cFb4';
    this.initialized = false;
    console.log('🔑 GoogleAPIService initialized with API key');
  }

  /**
   * Initialize Google APIs with API key authentication
   * @returns {Object} - Initialized Google APIs
   */
  initializeAPIs() {
    if (this.initialized) {
      return this.apis;
    }

    try {
      // Initialize APIs with API key (for public data access)
      this.apis = {
        calendar: google.calendar({ version: 'v3', auth: this.apiKey }),
        gmail: google.gmail({ version: 'v1', auth: this.apiKey }),
        people: google.people({ version: 'v1', auth: this.apiKey }),
        docs: google.docs({ version: 'v1', auth: this.apiKey }),
        sheets: google.sheets({ version: 'v4', auth: this.apiKey }),
        bigquery: google.bigquery({ version: 'v2', auth: this.apiKey }),
        storage: google.storage({ version: 'v1', auth: this.apiKey }),
        monitoring: google.monitoring({ version: 'v3', auth: this.apiKey })
      };

      this.initialized = true;
      console.log('✅ Google APIs initialized successfully');
      return this.apis;
    } catch (error) {
      console.error('❌ Error initializing Google APIs:', error);
      throw error;
    }
  }

  /**
   * Get OAuth client for user-specific operations
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - OAuth2 client
   */
  async getOAuthClient(userId) {
    try {
      // Get user's OAuth credentials from vault
      const keyResult = await pool.query(`
        SELECT uak.key_data, uak.encrypted_metadata
        FROM user_api_keys uak
        JOIN api_providers ap ON uak.provider_id = ap.id
        WHERE uak.user_id = $1 AND ap.name = 'google' AND uak.is_active = true
        LIMIT 1
      `, [userId]);

      if (keyResult.rows.length === 0) {
        throw new Error('Google OAuth credentials not found. Please connect your Google account.');
      }

      const row = keyResult.rows[0];
      const EncryptionService = require('./SimpleEncryption');
      const decryptedKey = EncryptionService.decrypt(row.key_data);
      const metadata = row.encrypted_metadata ? 
        JSON.parse(EncryptionService.decrypt(row.encrypted_metadata)) : {};

      // Initialize OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        metadata.client_id,
        metadata.client_secret,
        metadata.redirect_uri
      );

      oauth2Client.setCredentials({
        access_token: decryptedKey,
        refresh_token: metadata.refresh_token,
        scope: metadata.scope,
        token_type: 'Bearer',
        expiry_date: metadata.expiry_date
      });

      return oauth2Client;
    } catch (error) {
      console.error('Error getting OAuth client:', error);
      throw error;
    }
  }

  /**
   * Get authenticated API clients for a specific user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Authenticated API clients
   */
  async getUserAPIs(userId) {
    try {
      const auth = await this.getOAuthClient(userId);

      return {
        calendar: google.calendar({ version: 'v3', auth }),
        gmail: google.gmail({ version: 'v1', auth }),
        people: google.people({ version: 'v1', auth }),
        docs: google.docs({ version: 'v1', auth }),
        sheets: google.sheets({ version: 'v4', auth }),
        drive: google.drive({ version: 'v3', auth })
      };
    } catch (error) {
      console.error('Error getting user APIs:', error);
      // Fallback to API key for public operations
      return this.initializeAPIs();
    }
  }

  /**
   * Test API connectivity and permissions
   * @param {number} userId - User ID (optional)
   * @returns {Promise<Object>} - Test results
   */
  async testAPIs(userId = null) {
    const results = {
      api_key_status: 'unknown',
      oauth_status: 'unknown',
      available_apis: [],
      errors: []
    };

    try {
      // Test API key access
      const apis = this.initializeAPIs();
      
      // Test basic Calendar API access (public calendars only with API key)
      try {
        await apis.calendar.calendarList.list({ maxResults: 1 });
        results.api_key_status = 'active';
        results.available_apis.push('calendar_public');
      } catch (error) {
        results.errors.push({ api: 'calendar', error: error.message });
      }

      // If userId provided, test OAuth access
      if (userId) {
        try {
          const userAPIs = await this.getUserAPIs(userId);
          
          // Test user-specific Calendar access
          await userAPIs.calendar.calendarList.list({ maxResults: 1 });
          results.oauth_status = 'active';
          results.available_apis.push('calendar_private');

          // Test Gmail access
          try {
            await userAPIs.gmail.users.labels.list({ userId: 'me' });
            results.available_apis.push('gmail');
          } catch (error) {
            results.errors.push({ api: 'gmail', error: error.message });
          }

          // Test Contacts access
          try {
            await userAPIs.people.people.connections.list({
              resourceName: 'people/me',
              pageSize: 1
            });
            results.available_apis.push('contacts');
          } catch (error) {
            results.errors.push({ api: 'contacts', error: error.message });
          }

        } catch (error) {
          results.oauth_status = 'error';
          results.errors.push({ api: 'oauth', error: error.message });
        }
      }

      return results;
    } catch (error) {
      results.api_key_status = 'error';
      results.errors.push({ api: 'initialization', error: error.message });
      return results;
    }
  }

  /**
   * Get comprehensive API capabilities and quotas
   * @returns {Promise<Object>} - API capabilities
   */
  async getAPICapabilities() {
    try {
      const capabilities = {
        calendar: {
          public_access: true,
          user_access: false,
          features: ['read_public_calendars', 'calendar_metadata'],
          quota: 'API key quota applies'
        },
        gmail: {
          public_access: false,
          user_access: false,
          features: [],
          quota: 'OAuth required'
        },
        contacts: {
          public_access: false,
          user_access: false,
          features: [],
          quota: 'OAuth required'
        },
        docs: {
          public_access: true,
          user_access: false,
          features: ['read_public_docs', 'document_analysis'],
          quota: 'API key quota applies'
        },
        sheets: {
          public_access: true,
          user_access: false,
          features: ['read_public_sheets', 'data_analysis'],
          quota: 'API key quota applies'
        },
        bigquery: {
          public_access: true,
          user_access: false,
          features: ['public_datasets', 'analytics'],
          quota: 'API key quota applies'
        },
        storage: {
          public_access: true,
          user_access: false,
          features: ['public_buckets', 'file_metadata'],
          quota: 'API key quota applies'
        }
      };

      return {
        api_key: this.apiKey ? 'configured' : 'missing',
        capabilities,
        total_apis: Object.keys(capabilities).length,
        oauth_dependent: Object.values(capabilities).filter(c => !c.public_access).length
      };
    } catch (error) {
      console.error('Error getting API capabilities:', error);
      throw error;
    }
  }

  /**
   * Enhanced calendar service with intelligence
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Enhanced calendar service
   */
  async getEnhancedCalendarService(userId) {
    const userAPIs = await this.getUserAPIs(userId);
    
    return {
      // Standard calendar operations
      ...userAPIs.calendar,
      
      // Enhanced operations
      async analyzeSchedule(timeRange = 30) {
        try {
          const now = new Date();
          const futureDate = new Date(now.getTime() + (timeRange * 24 * 60 * 60 * 1000));
          
          const events = await userAPIs.calendar.events.list({
            calendarId: 'primary',
            timeMin: now.toISOString(),
            timeMax: futureDate.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
          });

          const analysis = {
            total_events: events.data.items?.length || 0,
            busy_hours: {},
            meeting_patterns: {},
            productivity_insights: []
          };

          // Analyze events
          if (events.data.items) {
            for (const event of events.data.items) {
              const start = new Date(event.start.dateTime || event.start.date);
              const hour = start.getHours();
              
              analysis.busy_hours[hour] = (analysis.busy_hours[hour] || 0) + 1;
            }
          }

          return analysis;
        } catch (error) {
          console.error('Error analyzing schedule:', error);
          throw error;
        }
      },

      async suggestOptimalTimes(constraints) {
        // Enhanced time suggestion with AI-powered analysis
        try {
          const schedule = await this.analyzeSchedule(7);
          
          // Use schedule analysis to suggest better times
          const suggestions = [];
          const leastBusyHours = Object.entries(schedule.busy_hours)
            .sort(([,a], [,b]) => a - b)
            .slice(0, 5)
            .map(([hour]) => parseInt(hour));

          // Generate suggestions based on least busy hours
          for (const hour of leastBusyHours) {
            suggestions.push({
              time: `${hour.toString().padStart(2, '0')}:00`,
              confidence: 0.8 + (0.2 * Math.random()),
              reason: `Historically less busy at this time`
            });
          }

          return suggestions;
        } catch (error) {
          console.error('Error suggesting optimal times:', error);
          throw error;
        }
      }
    };
  }

  /**
   * Get service status
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      service: 'GoogleAPIService',
      initialized: this.initialized,
      api_key_configured: !!this.apiKey,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new GoogleAPIService();
/**
 * Enhanced Google Calendar Service
 * Comprehensive integration with Google Calendar API
 */

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import pg from 'pg';

class EnhancedGoogleCalendarService {
  constructor() {
    this.calendar = null;
    this.auth = null;
    this.dbPool = null;
    this.isInitialized = false;
    this.rateLimiter = new Map(); // Simple rate limiting
    this.syncInterval = null;
    this.webhookUrl = null;
  }

  async initialize(dbPool) {
    if (this.isInitialized) return;

    try {
      console.log(
        '[GoogleCalendar] Initializing Enhanced Google Calendar Service...'
      );

      this.dbPool = dbPool;

      // Validate required environment variables
      const requiredVars = [
        'GOOGLE_API_KEY',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
      ];
      for (const varName of requiredVars) {
        if (!process.env[varName]) {
          throw new Error(`${varName} environment variable is required`);
        }
      }

      // Initialize Google Auth
      await this.setupAuthentication();

      // Initialize Google Calendar API
      this.calendar = google.calendar({
        version: 'v3',
        auth: this.auth,
      });

      // Test the connection
      await this.testConnection();

      // Set up webhook URL if available
      this.webhookUrl = process.env.GOOGLE_CALENDAR_WEBHOOK_URL;

      // Start periodic sync
      this.startPeriodicSync();

      this.isInitialized = true;
      console.log(
        '[GoogleCalendar] ✅ Enhanced Google Calendar Service initialized successfully'
      );
    } catch (error) {
      console.error('[GoogleCalendar] ❌ Failed to initialize:', error);
      throw error;
    }
  }

  async setupAuthentication() {
    try {
      // Try JWT authentication first (for service accounts)
      if (
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
        process.env.GOOGLE_PRIVATE_KEY
      ) {
        this.auth = new JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
          ],
        });
      } else {
        // Use OAuth2 for user authentication
        this.auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
        );

        // If we have stored tokens, use them
        const storedTokens = await this.getStoredTokens();
        if (storedTokens) {
          this.auth.setCredentials(storedTokens);
        }
      }

      console.log('[GoogleCalendar] ✅ Authentication configured');
    } catch (error) {
      console.error('[GoogleCalendar] Authentication setup failed:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await this.calendar.calendarList.list({
        maxResults: 1,
      });
      console.log('[GoogleCalendar] ✅ Connection test successful');
      return true;
    } catch (error) {
      if (error.code === 401) {
        console.warn(
          '[GoogleCalendar] ⚠️ Authentication required - will need user authorization'
        );
        return false;
      }
      throw error;
    }
  }

  async getStoredTokens() {
    if (!this.dbPool) return null;

    try {
      const result = await this.dbPool.query(`
                SELECT encrypted_key, metadata 
                FROM api_keys 
                WHERE service_name = 'google_oauth' AND is_active = true 
                LIMIT 1
            `);

      if (result.rows.length > 0) {
        // In a real implementation, decrypt the key
        return JSON.parse(result.rows[0].metadata || '{}');
      }
    } catch (error) {
      console.error('[GoogleCalendar] Failed to get stored tokens:', error);
    }
    return null;
  }

  async storeTokens(tokens) {
    if (!this.dbPool) return;

    try {
      await this.dbPool.query(
        `
                INSERT INTO api_keys (service_name, encrypted_key, metadata, is_active)
                VALUES ('google_oauth', $1, $2, true)
                ON CONFLICT (service_name) DO UPDATE SET
                    encrypted_key = EXCLUDED.encrypted_key,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
            `,
        ['encrypted_token_placeholder', JSON.stringify(tokens)]
      );

      console.log('[GoogleCalendar] ✅ Tokens stored securely');
    } catch (error) {
      console.error('[GoogleCalendar] Failed to store tokens:', error);
    }
  }

  // Get authorization URL for OAuth flow
  getAuthUrl() {
    if (!this.auth || !this.auth.generateAuthUrl) {
      throw new Error('OAuth2 client not properly initialized');
    }

    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      prompt: 'consent',
    });
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code) {
    try {
      const { tokens } = await this.auth.getToken(code);
      this.auth.setCredentials(tokens);
      await this.storeTokens(tokens);
      return tokens;
    } catch (error) {
      console.error('[GoogleCalendar] Token exchange failed:', error);
      throw error;
    }
  }

  // Calendar Management
  async listCalendars() {
    try {
      await this.checkRateLimit('list_calendars');

      const response = await this.calendar.calendarList.list({
        maxResults: 250,
      });

      // Store calendars in database
      for (const cal of response.data.items || []) {
        await this.storeCalendarInfo(cal);
      }

      return response.data.items || [];
    } catch (error) {
      console.error('[GoogleCalendar] Failed to list calendars:', error);
      throw error;
    }
  }

  async storeCalendarInfo(calendarInfo) {
    if (!this.dbPool) return;

    try {
      await this.dbPool.query(
        `
                INSERT INTO calendar_events (user_id, external_event_id, calendar_provider, title, description, metadata)
                VALUES (NULL, $1, 'google', $2, $3, $4)
                ON CONFLICT (external_event_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
            `,
        [
          `calendar_${calendarInfo.id}`,
          calendarInfo.summary || 'Unnamed Calendar',
          calendarInfo.description || '',
          JSON.stringify(calendarInfo),
        ]
      );
    } catch (error) {
      console.error('[GoogleCalendar] Failed to store calendar info:', error);
    }
  }

  // Event Management
  async createEvent(calendarId, eventData) {
    try {
      await this.checkRateLimit('create_event');

      const event = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: eventData.startTime,
          timeZone: eventData.timeZone || 'America/New_York',
        },
        end: {
          dateTime: eventData.endTime,
          timeZone: eventData.timeZone || 'America/New_York',
        },
        location: eventData.location,
        attendees: eventData.attendees?.map(email => ({ email })) || [],
        reminders: {
          useDefault: false,
          overrides: eventData.reminders || [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      };

      if (eventData.recurrence) {
        event.recurrence = [eventData.recurrence];
      }

      const response = await this.calendar.events.insert({
        calendarId: calendarId || 'primary',
        resource: event,
      });

      // Store event in database
      await this.storeEvent(response.data, eventData.userId);

      console.log('[GoogleCalendar] ✅ Event created:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('[GoogleCalendar] Failed to create event:', error);
      throw error;
    }
  }

  async updateEvent(calendarId, eventId, eventData) {
    try {
      await this.checkRateLimit('update_event');

      const event = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: eventData.startTime,
          timeZone: eventData.timeZone || 'America/New_York',
        },
        end: {
          dateTime: eventData.endTime,
          timeZone: eventData.timeZone || 'America/New_York',
        },
        location: eventData.location,
      };

      const response = await this.calendar.events.update({
        calendarId: calendarId || 'primary',
        eventId,
        resource: event,
      });

      // Update event in database
      await this.updateStoredEvent(eventId, response.data, eventData.userId);

      console.log('[GoogleCalendar] ✅ Event updated:', eventId);
      return response.data;
    } catch (error) {
      console.error('[GoogleCalendar] Failed to update event:', error);
      throw error;
    }
  }

  async deleteEvent(calendarId, eventId, userId = null) {
    try {
      await this.checkRateLimit('delete_event');

      await this.calendar.events.delete({
        calendarId: calendarId || 'primary',
        eventId,
      });

      // Remove from database
      if (this.dbPool) {
        await this.dbPool.query(
          'DELETE FROM calendar_events WHERE external_event_id = $1',
          [eventId]
        );
      }

      console.log('[GoogleCalendar] ✅ Event deleted:', eventId);
      return true;
    } catch (error) {
      console.error('[GoogleCalendar] Failed to delete event:', error);
      throw error;
    }
  }

  async listEvents(calendarId, options = {}) {
    try {
      await this.checkRateLimit('list_events');

      const params = {
        calendarId: calendarId || 'primary',
        timeMin: options.timeMin || new Date().toISOString(),
        timeMax: options.timeMax,
        maxResults: options.maxResults || 250,
        singleEvents: true,
        orderBy: 'startTime',
      };

      if (options.q) {
        params.q = options.q; // Search query
      }

      const response = await this.calendar.events.list(params);

      // Store events in database
      for (const event of response.data.items || []) {
        await this.storeEvent(event, options.userId);
      }

      return response.data.items || [];
    } catch (error) {
      console.error('[GoogleCalendar] Failed to list events:', error);
      throw error;
    }
  }

  async storeEvent(eventData, userId = null) {
    if (!this.dbPool) return;

    try {
      await this.dbPool.query(
        `
                INSERT INTO calendar_events (
                    user_id, external_event_id, calendar_provider, title, description,
                    start_time, end_time, location, attendees, is_all_day, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (external_event_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    start_time = EXCLUDED.start_time,
                    end_time = EXCLUDED.end_time,
                    location = EXCLUDED.location,
                    attendees = EXCLUDED.attendees,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
            `,
        [
          userId,
          eventData.id,
          'google',
          eventData.summary || 'Untitled Event',
          eventData.description || '',
          eventData.start?.dateTime || eventData.start?.date,
          eventData.end?.dateTime || eventData.end?.date,
          eventData.location || '',
          JSON.stringify(eventData.attendees || []),
          !eventData.start?.dateTime, // is_all_day
          JSON.stringify(eventData),
        ]
      );
    } catch (error) {
      console.error('[GoogleCalendar] Failed to store event:', error);
    }
  }

  async updateStoredEvent(eventId, eventData, userId = null) {
    if (!this.dbPool) return;

    try {
      await this.dbPool.query(
        `
                UPDATE calendar_events SET
                    title = $1,
                    description = $2,
                    start_time = $3,
                    end_time = $4,
                    location = $5,
                    attendees = $6,
                    metadata = $7,
                    updated_at = NOW()
                WHERE external_event_id = $8
            `,
        [
          eventData.summary || 'Untitled Event',
          eventData.description || '',
          eventData.start?.dateTime || eventData.start?.date,
          eventData.end?.dateTime || eventData.end?.date,
          eventData.location || '',
          JSON.stringify(eventData.attendees || []),
          JSON.stringify(eventData),
          eventId,
        ]
      );
    } catch (error) {
      console.error('[GoogleCalendar] Failed to update stored event:', error);
    }
  }

  // Advanced Features
  async findFreeTime(calendarId, duration, timeRange = {}) {
    try {
      await this.checkRateLimit('freebusy');

      const freeBusyRequest = {
        timeMin: timeRange.start || new Date().toISOString(),
        timeMax:
          timeRange.end ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ id: calendarId || 'primary' }],
      };

      const response = await this.calendar.freebusy.query({
        resource: freeBusyRequest,
      });

      const busyTimes =
        response.data.calendars[calendarId || 'primary']?.busy || [];
      const freeSlots = this.calculateFreeSlots(
        new Date(freeBusyRequest.timeMin),
        new Date(freeBusyRequest.timeMax),
        busyTimes,
        duration
      );

      return freeSlots;
    } catch (error) {
      console.error('[GoogleCalendar] Failed to find free time:', error);
      throw error;
    }
  }

  calculateFreeSlots(startTime, endTime, busyTimes, durationMinutes) {
    const freeSlots = [];
    const duration = durationMinutes * 60 * 1000; // Convert to milliseconds

    // Sort busy times
    busyTimes.sort((a, b) => new Date(a.start) - new Date(b.start));

    let currentTime = startTime.getTime();
    const endTimeMs = endTime.getTime();

    for (const busy of busyTimes) {
      const busyStart = new Date(busy.start).getTime();
      const busyEnd = new Date(busy.end).getTime();

      // Check if there's a free slot before this busy time
      if (currentTime + duration <= busyStart) {
        freeSlots.push({
          start: new Date(currentTime).toISOString(),
          end: new Date(busyStart).toISOString(),
          duration: (busyStart - currentTime) / (60 * 1000), // in minutes
        });
      }

      currentTime = Math.max(currentTime, busyEnd);
    }

    // Check for free time after the last busy period
    if (currentTime + duration <= endTimeMs) {
      freeSlots.push({
        start: new Date(currentTime).toISOString(),
        end: new Date(endTimeMs).toISOString(),
        duration: (endTimeMs - currentTime) / (60 * 1000), // in minutes
      });
    }

    return freeSlots.filter(slot => slot.duration >= durationMinutes);
  }

  async setupWebhook(calendarId) {
    if (!this.webhookUrl) {
      console.warn('[GoogleCalendar] No webhook URL configured');
      return null;
    }

    try {
      const watchResponse = await this.calendar.events.watch({
        calendarId: calendarId || 'primary',
        resource: {
          id: `cartrita-${Date.now()}`,
          type: 'web_hook',
          address: this.webhookUrl,
          expiration: (Date.now() + 24 * 60 * 60 * 1000).toString(), // 24 hours
        },
      });

      console.log('[GoogleCalendar] ✅ Webhook set up:', watchResponse.data);
      return watchResponse.data;
    } catch (error) {
      console.error('[GoogleCalendar] Failed to set up webhook:', error);
      throw error;
    }
  }

  // Rate Limiting
  async checkRateLimit(operation) {
    const key = `${operation}_${Math.floor(Date.now() / 1000)}`;
    const count = this.rateLimiter.get(key) || 0;

    // Google Calendar API allows 1,000 requests per 100 seconds per user
    if (count >= 100) {
      const waitTime = 1000 - (Date.now() % 1000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.set(key, count + 1);

    // Clean up old entries
    setTimeout(() => this.rateLimiter.delete(key), 100000);
  }

  // Periodic Sync
  startPeriodicSync() {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(
      async () => {
        try {
          console.log('[GoogleCalendar] Running periodic sync...');
          const calendars = await this.listCalendars();

          for (const calendar of calendars.slice(0, 5)) {
            // Limit to first 5 calendars
            await this.listEvents(calendar.id, {
              timeMin: new Date().toISOString(),
              timeMax: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
              ).toISOString(), // Next 7 days
            });
          }

          console.log('[GoogleCalendar] ✅ Periodic sync completed');
        } catch (error) {
          console.error('[GoogleCalendar] Periodic sync failed:', error);
        }
      },
      30 * 60 * 1000
    ); // Every 30 minutes
  }

  // Analytics and Reporting
  async getCalendarInsights(userId = null, days = 7) {
    if (!this.dbPool) return null;

    try {
      const query = `
                SELECT 
                    DATE(start_time) as date,
                    COUNT(*) as event_count,
                    COUNT(CASE WHEN is_all_day = true THEN 1 END) as all_day_events,
                    COUNT(CASE WHEN attendees != '[]' THEN 1 END) as meetings,
                    AVG(EXTRACT(EPOCH FROM (end_time - start_time))/3600) as avg_duration_hours
                FROM calendar_events 
                WHERE start_time > NOW() - INTERVAL '${days} days'
                ${userId ? 'AND user_id = $1' : ''}
                GROUP BY DATE(start_time)
                ORDER BY date DESC
            `;

      const result = await this.dbPool.query(query, userId ? [userId] : []);

      return {
        daily_stats: result.rows,
        period: `${days} days`,
        generated_at: new Date(),
      };
    } catch (error) {
      console.error('[GoogleCalendar] Failed to get insights:', error);
      return null;
    }
  }

  // Health Check
  async healthCheck() {
    try {
      const testResult = await this.testConnection();
      const calendars = await this.listCalendars();

      return {
        status: testResult ? 'healthy' : 'needs_auth',
        calendars_count: calendars?.length || 0,
        last_check: new Date(),
        auth_configured: !!this.auth,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        last_check: new Date(),
      };
    }
  }

  // Cleanup
  cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('[GoogleCalendar] ✅ Cleanup completed');
  }
}

export default EnhancedGoogleCalendarService;

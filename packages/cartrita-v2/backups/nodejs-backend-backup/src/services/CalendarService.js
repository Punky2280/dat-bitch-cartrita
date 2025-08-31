/* global process, console */
import { google } from 'googleapis';
import pool from '../db.js';
import EncryptionService from './SimpleEncryption.js';
import GoogleAPIService from './GoogleAPIService.js';

/**
 * CalendarService - Enhanced Google Calendar integration with AI-powered features
 * Features:
 * - Google Calendar API integration with OAuth2
 * - Event creation, modification, and deletion
 * - Smart scheduling and availability checking
 * - Calendar synchronization with local storage
 * - AI-powered meeting time suggestions
 * - Enhanced analytics and productivity insights
 * - Multi-calendar support with conflict resolution
 * - Robust error handling and retry mechanisms
 */
class CalendarService {
  constructor() {
    this.initialized = false;
    this.calendar = null;
    this.googleAPI = GoogleAPIService;
    this.currentUserId = null;
    this.lastError = null;
    this.errorCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.healthStatus = 'unknown';
    this.initTime = Date.now();

    // Configuration
    this.config = {
      maxEventsPerSync: 1000,
      syncRetentionMonths: 3,
      defaultTimeZone: 'UTC',
      maxSuggestionsCount: 20,
      rateLimitDelay: 100, // ms between API calls
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
    };

    console.log(
      '📅 CalendarService initialized with enhanced Google API integration'
    );
  }

  /**
   * Initialize Calendar service with user's OAuth credentials
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async initializeForUser(userId) {
    if (!userId) {
      throw new Error('User ID is required for calendar initialization');
    }

    try {
      // Use enhanced GoogleAPIService for user authentication
      const userAPIs = await this.googleAPI.getUserAPIs(userId);
      this.calendar = userAPIs.calendar;
      this.currentUserId = userId;
      this.initialized = true;
      this.healthStatus = 'healthy';
      this.lastError = null;

      console.log(`✅ Calendar service initialized for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error initializing Calendar service:', error);
      this.lastError = error.message;
      this.errorCount++;

      // Fallback to legacy authentication method
      try {
        console.log('🔄 Attempting legacy authentication fallback...');
        return await this.legacyInitializeForUser(userId);
      } catch (fallbackError) {
        console.error('Legacy fallback also failed:', fallbackError);
        this.healthStatus = 'error';
        throw new Error(
          `Failed to initialize calendar service: ${error.message}`
        );
      }
    }
  }

  /**
   * Legacy initialization method (backup)
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async legacyInitializeForUser(userId) {
    try {
      // Get encrypted Google credentials from database
      const keyResult = await pool.query(
        'SELECT key_data, encrypted_metadata FROM user_api_keys WHERE user_id = $1 AND service = $2',
        [userId, 'google_calendar']
      );

      if (keyResult.rows.length === 0) {
        throw new Error(
          'Google Calendar API credentials not found. Please connect your Google account.'
        );
      }

      const row = keyResult.rows[0];
      const decryptedKey = EncryptionService.decrypt(row.key_data);
      const metadata = row.encrypted_metadata
        ? JSON.parse(EncryptionService.decrypt(row.encrypted_metadata))
        : {};

      // Initialize Google OAuth2 client with updated credentials
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID || metadata.client_id,
        process.env.GOOGLE_CLIENT_SECRET || metadata.client_secret,
        metadata.redirect_uri
      );

      oauth2Client.setCredentials({
        access_token: decryptedKey,
        refresh_token: metadata.refresh_token,
        scope: metadata.scope,
        token_type: 'Bearer',
        expiry_date: metadata.expiry_date,
      });

      // Initialize Calendar API client
      this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      this.currentUserId = userId;
      this.initialized = true;
      this.healthStatus = 'healthy';

      return true;
    } catch (error) {
      console.error('Error in legacy calendar initialization:', error);
      this.healthStatus = 'error';
      throw error;
    }
  }

  /**
   * Sync user's calendars from Google
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Sync results
   */
  async syncCalendars(userId) {
    await this.initializeForUser(userId);

    try {
      // Fetch user's calendar list
      const calendarListResponse = await this.calendar.calendarList.list({
        minAccessRole: 'reader',
        showDeleted: false,
        showHidden: false,
      });

      const calendars = calendarListResponse.data.items || [];
      const syncResults = {
        calendars_synced: 0,
        events_synced: 0,
        errors: [],
      };

      for (const calendar of calendars) {
        try {
          // Store/update calendar sync info
          await pool.query(
            `
            INSERT INTO user_calendar_sync 
            (user_id, calendar_id, calendar_name, provider, calendar_color, 
             is_primary, access_role, sync_enabled, last_sync_at)
            VALUES ($1, $2, $3, 'google', $4, $5, $6, true, NOW())
            ON CONFLICT (user_id, calendar_id, provider)
            DO UPDATE SET
              calendar_name = EXCLUDED.calendar_name,
              calendar_color = EXCLUDED.calendar_color,
              is_primary = EXCLUDED.is_primary,
              access_role = EXCLUDED.access_role,
              last_sync_at = NOW()
          `,
            [
              userId,
              calendar.id,
              calendar.summary,
              calendar.backgroundColor,
              calendar.primary || false,
              calendar.accessRole,
            ]
          );

          // Sync events for this calendar
          const eventsSynced = await this.syncCalendarEvents(
            userId,
            calendar.id
          );
          syncResults.events_synced += eventsSynced;
          syncResults.calendars_synced++;

          // Add rate limiting
          await this.delay(this.config.rateLimitDelay);
        } catch (calendarError) {
          console.error(
            `Error syncing calendar ${calendar.id}:`,
            calendarError
          );
          syncResults.errors.push({
            calendar_id: calendar.id,
            error: calendarError.message,
          });
        }
      }

      return syncResults;
    } catch (error) {
      console.error('Error syncing calendars:', error);
      this.handleError(error, 'sync_calendars');
      throw error;
    }
  }

  /**
   * Sync events for a specific calendar
   * @param {number} userId - User ID
   * @param {string} calendarId - Calendar ID
   * @returns {Promise<number>} - Number of events synced
   */
  async syncCalendarEvents(userId, calendarId) {
    try {
      // Get last sync token for incremental sync
      const syncResult = await pool.query(
        'SELECT sync_token FROM user_calendar_sync WHERE user_id = $1 AND calendar_id = $2',
        [userId, calendarId]
      );

      const syncToken = syncResult.rows[0]?.sync_token;
      const now = new Date();
      const threeMonthsAgo = new Date(
        now.getTime() -
          this.config.syncRetentionMonths * 30 * 24 * 60 * 60 * 1000
      );

      const eventsParams = {
        calendarId: calendarId,
        timeMin: threeMonthsAgo.toISOString(),
        maxResults: this.config.maxEventsPerSync,
        singleEvents: true,
        orderBy: 'startTime',
      };

      if (syncToken) {
        eventsParams.syncToken = syncToken;
        delete eventsParams.timeMin; // Can't use both syncToken and timeMin
      }

      const eventsResponse = await this.calendar.events.list(eventsParams);
      const events = eventsResponse.data.items || [];
      let eventsSynced = 0;

      for (const event of events) {
        try {
          if (event.status === 'cancelled') {
            // Remove cancelled events
            await pool.query(
              'DELETE FROM user_calendar_events WHERE user_id = $1 AND calendar_id = $2 AND event_id = $3',
              [userId, calendarId, event.id]
            );
          } else {
            // Insert or update event
            await this.storeCalendarEvent(userId, calendarId, event);
            eventsSynced++;
          }
        } catch (eventError) {
          console.error(`Error processing event ${event.id}:`, eventError);
        }
      }

      // Update sync token for next incremental sync
      if (eventsResponse.data.nextSyncToken) {
        await pool.query(
          'UPDATE user_calendar_sync SET sync_token = $1, last_sync_at = NOW() WHERE user_id = $2 AND calendar_id = $3',
          [eventsResponse.data.nextSyncToken, userId, calendarId]
        );
      }

      return eventsSynced;
    } catch (error) {
      console.error('Error syncing calendar events:', error);
      this.handleError(error, 'sync_events');
      throw error;
    }
  }

  /**
   * Store a calendar event in the database
   * @param {number} userId - User ID
   * @param {string} calendarId - Calendar ID
   * @param {Object} event - Google Calendar event object
   */
  async storeCalendarEvent(userId, calendarId, event) {
    try {
      const startTime = this.parseEventDateTime(event.start);
      const endTime = this.parseEventDateTime(event.end);

      const attendees = event.attendees
        ? event.attendees.map(attendee => ({
            email: attendee.email,
            name: attendee.displayName,
            status: attendee.responseStatus,
            optional: attendee.optional,
          }))
        : [];

      const reminderMinutes = event.reminders?.overrides
        ? event.reminders.overrides.map(r => r.minutes)
        : [];

      await pool.query(
        `
        INSERT INTO user_calendar_events 
        (user_id, calendar_id, event_id, title, description, start_time, end_time, 
         timezone, location, attendees, recurrence_rule, reminder_minutes, status, 
         visibility, meeting_url, synced_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        ON CONFLICT (user_id, calendar_id, event_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          timezone = EXCLUDED.timezone,
          location = EXCLUDED.location,
          attendees = EXCLUDED.attendees,
          recurrence_rule = EXCLUDED.recurrence_rule,
          reminder_minutes = EXCLUDED.reminder_minutes,
          status = EXCLUDED.status,
          visibility = EXCLUDED.visibility,
          meeting_url = EXCLUDED.meeting_url,
          synced_at = NOW(),
          updated_at = NOW()
      `,
        [
          userId,
          calendarId,
          event.id,
          event.summary || 'Untitled Event',
          event.description || null,
          startTime,
          endTime,
          event.start?.timeZone || this.config.defaultTimeZone,
          event.location || null,
          JSON.stringify(attendees),
          event.recurrence ? event.recurrence[0] : null,
          reminderMinutes,
          event.status || 'confirmed',
          event.visibility || 'default',
          this.extractMeetingUrl(event.description || event.location || ''),
        ]
      );
    } catch (error) {
      console.error('Error storing calendar event:', error);
      throw error;
    }
  }

  /**
   * Create a new calendar event
   * @param {number} userId - User ID
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} - Created event
   */
  async createEvent(userId, eventData) {
    await this.initializeForUser(userId);

    try {
      const {
        calendarId = 'primary',
        title,
        description,
        startTime,
        endTime,
        timezone = this.config.defaultTimeZone,
        location,
        attendees = [],
        reminderMinutes = [15],
      } = eventData;

      // Validate required fields
      if (!title || !startTime || !endTime) {
        throw new Error('Title, start time, and end time are required');
      }

      const googleEvent = {
        summary: title,
        description: description,
        start: {
          dateTime: new Date(startTime).toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: new Date(endTime).toISOString(),
          timeZone: timezone,
        },
        location: location,
        attendees: attendees.map(email => ({ email })),
        reminders: {
          useDefault: false,
          overrides: reminderMinutes.map(minutes => ({
            method: 'popup',
            minutes: minutes,
          })),
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: calendarId,
        resource: googleEvent,
        sendUpdates: 'all',
      });

      // Store in local database
      await this.storeCalendarEvent(userId, calendarId, response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      this.handleError(error, 'create_event');
      throw error;
    }
  }

  /**
   * Update an existing calendar event
   * @param {number} userId - User ID
   * @param {string} eventId - Event ID
   * @param {Object} eventData - Updated event data
   * @returns {Promise<Object>} - Updated event
   */
  async updateEvent(userId, eventId, eventData) {
    await this.initializeForUser(userId);

    try {
      const { calendarId = 'primary', ...updateData } = eventData;

      // Get current event
      const currentEvent = await this.calendar.events.get({
        calendarId: calendarId,
        eventId: eventId,
      });

      // Merge updates with current event
      const updatedEvent = {
        ...currentEvent.data,
        summary: updateData.title || currentEvent.data.summary,
        description:
          updateData.description !== undefined
            ? updateData.description
            : currentEvent.data.description,
        location:
          updateData.location !== undefined
            ? updateData.location
            : currentEvent.data.location,
      };

      if (updateData.startTime) {
        updatedEvent.start = {
          dateTime: new Date(updateData.startTime).toISOString(),
          timeZone: updateData.timezone || currentEvent.data.start.timeZone,
        };
      }

      if (updateData.endTime) {
        updatedEvent.end = {
          dateTime: new Date(updateData.endTime).toISOString(),
          timeZone: updateData.timezone || currentEvent.data.end.timeZone,
        };
      }

      if (updateData.attendees) {
        updatedEvent.attendees = updateData.attendees.map(email => ({ email }));
      }

      const response = await this.calendar.events.update({
        calendarId: calendarId,
        eventId: eventId,
        resource: updatedEvent,
        sendUpdates: 'all',
      });

      // Update in local database
      await this.storeCalendarEvent(userId, calendarId, response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      this.handleError(error, 'update_event');
      throw error;
    }
  }

  /**
   * Delete a calendar event
   * @param {number} userId - User ID
   * @param {string} eventId - Event ID
   * @param {string} calendarId - Calendar ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteEvent(userId, eventId, calendarId = 'primary') {
    await this.initializeForUser(userId);

    try {
      await this.calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId,
        sendUpdates: 'all',
      });

      // Remove from local database
      await pool.query(
        'DELETE FROM user_calendar_events WHERE user_id = $1 AND calendar_id = $2 AND event_id = $3',
        [userId, calendarId, eventId]
      );

      return true;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      this.handleError(error, 'delete_event');
      throw error;
    }
  }

  /**
   * Get user's calendar events with filtering
   * @param {number} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} - Calendar events
   */
  async getEvents(userId, filters = {}) {
    try {
      const {
        startDate,
        endDate,
        calendarIds,
        limit = 100,
        offset = 0,
      } = filters;

      let query = `
        SELECT ce.*, cs.calendar_name, cs.calendar_color, cs.is_primary
        FROM user_calendar_events ce
        JOIN user_calendar_sync cs ON ce.calendar_id = cs.calendar_id AND ce.user_id = cs.user_id
        WHERE ce.user_id = $1
      `;
      const params = [userId];
      let paramCount = 1;

      if (startDate) {
        paramCount++;
        query += ` AND ce.start_time >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND ce.end_time <= $${paramCount}`;
        params.push(endDate);
      }

      if (calendarIds && calendarIds.length > 0) {
        paramCount++;
        query += ` AND ce.calendar_id = ANY($${paramCount})`;
        params.push(calendarIds);
      }

      query += ` ORDER BY ce.start_time ASC LIMIT $${paramCount + 1} OFFSET $${
        paramCount + 2
      }`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting calendar events:', error);
      this.handleError(error, 'get_events');
      throw error;
    }
  }

  /**
   * Check availability for a given time period
   * @param {number} userId - User ID
   * @param {string} startTime - Start time
   * @param {string} endTime - End time
   * @param {Array} calendarIds - Calendar IDs to check
   * @returns {Promise<Object>} - Availability information
   */
  async checkAvailability(userId, startTime, endTime, calendarIds = []) {
    try {
      let query = `
        SELECT 
          COUNT(*) as conflicting_events,
          ARRAY_AGG(title) as conflicting_titles
        FROM user_calendar_events 
        WHERE user_id = $1 
          AND status != 'cancelled'
          AND ((start_time < $3 AND end_time > $2))
      `;
      const params = [userId, startTime, endTime];

      if (calendarIds.length > 0) {
        query += ` AND calendar_id = ANY($4)`;
        params.push(calendarIds);
      }

      const result = await pool.query(query, params);
      const row = result.rows[0];

      return {
        is_available: parseInt(row.conflicting_events) === 0,
        conflicting_events: parseInt(row.conflicting_events),
        conflicting_titles: row.conflicting_titles || [],
      };
    } catch (error) {
      console.error('Error checking availability:', error);
      this.handleError(error, 'check_availability');
      throw error;
    }
  }

  /**
   * Find optimal meeting times based on attendee availability (Enhanced)
   * @param {number} userId - User ID
   * @param {Object} constraints - Meeting constraints
   * @returns {Promise<Array>} - Suggested time slots
   */
  async suggestMeetingTimes(userId, constraints) {
    try {
      const {
        duration = 60, // minutes
        attendees = [],
        startDate,
        endDate,
        workHours = { start: '09:00', end: '17:00' },
        timezone = this.config.defaultTimeZone,
      } = constraints;

      // Try to use enhanced calendar service for AI-powered suggestions
      try {
        const enhancedService =
          await this.googleAPI.getEnhancedCalendarService(userId);
        const aiSuggestions =
          await enhancedService.suggestOptimalTimes(constraints);
        if (aiSuggestions && aiSuggestions.length > 0) {
          console.log('✨ Using AI-powered time suggestions');
          return aiSuggestions.map(suggestion => ({
            start_time: suggestion.time,
            end_time: new Date(
              new Date(suggestion.time).getTime() + duration * 60000
            ).toISOString(),
            confidence: suggestion.confidence,
            reason: suggestion.reason,
          }));
        }
      } catch (enhancedError) {
        console.log('📅 Falling back to standard time suggestions');
      }

      const suggestions = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // Skip weekends
        if (d.getDay() === 0 || d.getDay() === 6) continue;

        // Check hourly slots during work hours
        for (
          let hour = parseInt(workHours.start);
          hour < parseInt(workHours.end);
          hour++
        ) {
          const slotStart = new Date(d);
          slotStart.setHours(hour, 0, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + duration);

          // Check if this slot is available
          const availability = await this.checkAvailability(
            userId,
            slotStart.toISOString(),
            slotEnd.toISOString()
          );

          if (availability.is_available) {
            suggestions.push({
              start_time: slotStart.toISOString(),
              end_time: slotEnd.toISOString(),
              confidence: 0.8, // Standard confidence for rule-based suggestions
              reason: 'Available time slot during work hours',
            });
          }

          // Limit suggestions
          if (suggestions.length >= this.config.maxSuggestionsCount) {
            break;
          }
        }

        if (suggestions.length >= this.config.maxSuggestionsCount) {
          break;
        }
      }

      return suggestions;
    } catch (error) {
      console.error('Error suggesting meeting times:', error);
      this.handleError(error, 'suggest_meeting_times');
      throw error;
    }
  }

  /**
   * Get enhanced calendar analytics
   * @param {number} userId - User ID
   * @param {number} days - Number of days to analyze
   * @returns {Promise<Object>} - Enhanced analytics
   */
  async getEnhancedAnalytics(userId, days = 30) {
    try {
      await this.initializeForUser(userId);

      // Try to get enhanced analytics from GoogleAPIService
      try {
        const enhancedService =
          await this.googleAPI.getEnhancedCalendarService(userId);
        const scheduleAnalysis = await enhancedService.analyzeSchedule(days);

        // Combine with our database statistics
        const dbStats = await this.getBasicStats(userId, days);

        return {
          ...dbStats,
          ai_analysis: scheduleAnalysis,
          productivity_insights: scheduleAnalysis.productivity_insights || [],
          busy_hours_analysis: scheduleAnalysis.busy_hours || {},
          meeting_patterns: scheduleAnalysis.meeting_patterns || {},
        };
      } catch (enhancedError) {
        console.log('📊 Using basic analytics only');
        return await this.getBasicStats(userId, days);
      }
    } catch (error) {
      console.error('Error getting enhanced analytics:', error);
      this.handleError(error, 'get_analytics');
      throw error;
    }
  }

  /**
   * Get basic statistics from database
   * @param {number} userId - User ID
   * @param {number} days - Number of days
   * @returns {Promise<Object>} - Basic statistics
   */
  async getBasicStats(userId, days = 30) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN start_time >= NOW() THEN 1 END) as upcoming_events,
          COUNT(CASE WHEN start_time < NOW() AND end_time > NOW() THEN 1 END) as current_events,
          COUNT(DISTINCT calendar_id) as active_calendars,
          AVG(EXTRACT(EPOCH FROM (end_time - start_time))/60) as avg_duration_minutes
        FROM user_calendar_events
        WHERE user_id = $1 
          AND start_time >= NOW() - INTERVAL '${parseInt(days)} days'
          AND status != 'cancelled'
      `;

      const result = await pool.query(statsQuery, [userId]);
      const stats = result.rows[0];

      return {
        total_events: parseInt(stats.total_events) || 0,
        upcoming_events: parseInt(stats.upcoming_events) || 0,
        current_events: parseInt(stats.current_events) || 0,
        active_calendars: parseInt(stats.active_calendars) || 0,
        avg_duration_minutes: parseFloat(stats.avg_duration_minutes) || 0,
      };
    } catch (error) {
      console.error('Error getting basic stats:', error);
      throw error;
    }
  }

  /**
   * Helper: Parse Google Calendar datetime
   * @param {Object} dateTime - Google Calendar date/time object
   * @returns {Date} - Parsed date
   */
  parseEventDateTime(dateTime) {
    if (!dateTime) return null;

    if (dateTime.dateTime) {
      return new Date(dateTime.dateTime);
    } else if (dateTime.date) {
      return new Date(dateTime.date + 'T00:00:00Z');
    }

    return null;
  }

  /**
   * Helper: Extract meeting URL from text
   * @param {string} text - Text to search
   * @returns {string|null} - Meeting URL or null
   */
  extractMeetingUrl(text) {
    if (!text) return null;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);

    if (!urls) return null;

    const meetingPlatforms = [
      'zoom.us',
      'meet.google.com',
      'teams.microsoft.com',
      'webex.com',
    ];

    for (const url of urls) {
      for (const platform of meetingPlatforms) {
        if (url.includes(platform)) {
          return url;
        }
      }
    }

    return urls[0]; // Return first URL if no meeting platform detected
  }

  /**
   * Test calendar API connectivity
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Test results
   */
  async testConnectivity(userId) {
    try {
      await this.initializeForUser(userId);

      // Test basic calendar access
      const calendarList = await this.calendar.calendarList.list({
        maxResults: 1,
      });

      return {
        success: true,
        calendars_accessible: calendarList.data.items?.length || 0,
        enhanced_features_available: !!this.googleAPI,
        message: 'Calendar API connectivity verified',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        enhanced_features_available: false,
        message: 'Calendar API connectivity failed',
      };
    }
  }

  /**
   * Get service status
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      service: 'CalendarService',
      version: '2.0-enhanced',
      initialized: this.initialized,
      current_user: this.currentUserId || null,
      google_api_service: this.googleAPI ? 'connected' : 'disconnected',
      health_status: this.healthStatus,
      error_count: this.errorCount,
      last_error: this.lastError,
      uptime: Date.now() - this.initTime,
      features: {
        basic_calendar_ops: true,
        ai_powered_suggestions: true,
        enhanced_analytics: true,
        smart_scheduling: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get detailed health status
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    const issues = [];
    let status = 'healthy';

    if (!this.initialized) {
      status = 'error';
      issues.push('Service not initialized');
    }

    if (this.errorCount > 10) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`High error count: ${this.errorCount}`);
    }

    if (!this.googleAPI) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push('GoogleAPIService not available');
    }

    return {
      status,
      issues,
      error_count: this.errorCount,
      last_error: this.lastError,
      timestamp: new Date().toISOString(),
    };
  }

  // Utility methods
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  handleError(error, context = 'unknown') {
    this.errorCount++;
    this.lastError = error.message;

    if (this.errorCount > 20) {
      this.healthStatus = 'critical';
      console.error(
        `[CalendarService] ⚠️ Critical error count reached (${this.errorCount})`
      );
    }

    console.error(`[CalendarService] Error in ${context}:`, error.message);
  }

  async destroy() {
    try {
      console.log('[CalendarService] 🔄 Destroying service...');

      this.initialized = false;
      this.calendar = null;
      this.currentUserId = null;
      this.healthStatus = 'destroyed';

      console.log('[CalendarService] ✅ Service destroyed successfully');
    } catch (error) {
      console.error('[CalendarService] ❌ Error during destroy:', error);
    }
  }
}

export default new CalendarService();

const { google } = require('googleapis');
const axios = require('axios');
const pool = require('../db');
const EncryptionService = require('./SimpleEncryption');
const GoogleAPIService = require('./GoogleAPIService');

class EmailService {
  constructor() {
    this.initialized = false;
    this.gmail = null;
    this.outlook = null;
    this.googleAPI = GoogleAPIService;
    this.currentUserId = null;
    console.log('📧 EmailService initialized with enhanced Google API integration');
  }

  /**
   * Initialize Email service for a specific provider
   * @param {number} userId - User ID
   * @param {string} provider - Email provider ('gmail' or 'outlook')
   * @returns {Promise<boolean>} - Success status
   */
  async initializeForProvider(userId, provider = 'gmail') {
    try {
      if (provider === 'gmail') {
        return await this.initializeGmail(userId);
      } else if (provider === 'outlook') {
        return await this.initializeOutlook(userId);
      } else {
        throw new Error(`Unsupported email provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Error initializing ${provider} service:`, error);
      throw error;
    }
  }

  /**
   * Initialize Gmail API client (Enhanced)
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async initializeGmail(userId) {
    try {
      // Try enhanced GoogleAPIService first
      try {
        const userAPIs = await this.googleAPI.getUserAPIs(userId);
        this.gmail = userAPIs.gmail;
        this.currentUserId = userId;
        this.initialized = true;
        console.log(`✅ Enhanced Gmail service initialized for user ${userId}`);
        return true;
      } catch (enhancedError) {
        console.log('🔄 Enhanced Gmail initialization failed, using legacy method...');
      }

      // Fallback to legacy method
      const keyResult = await pool.query(`
        SELECT uak.key_data, uak.encrypted_metadata
        FROM user_api_keys uak
        JOIN api_providers ap ON uak.provider_id = ap.id
        WHERE uak.user_id = $1 AND ap.name = 'google' AND uak.is_active = true
        LIMIT 1
      `, [userId]);

      if (keyResult.rows.length === 0) {
        throw new Error('Gmail API credentials not found. Please connect your Google account.');
      }

      const row = keyResult.rows[0];
      const decryptedKey = EncryptionService.decrypt(row.key_data);
      const metadata = row.encrypted_metadata ? 
        JSON.parse(EncryptionService.decrypt(row.encrypted_metadata)) : {};

      // Initialize Google OAuth2 client
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

      // Initialize Gmail API client
      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      this.currentUserId = userId;
      this.initialized = true;
      console.log(`✅ Legacy Gmail service initialized for user ${userId}`);

      return true;
    } catch (error) {
      console.error('Error initializing Gmail service:', error);
      throw error;
    }
  }

  /**
   * Initialize Outlook API client
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async initializeOutlook(userId) {
    try {
      // Get user's Outlook API credentials from vault
      const keyResult = await pool.query(`
        SELECT uak.key_data, uak.encrypted_metadata
        FROM user_api_keys uak
        JOIN api_providers ap ON uak.provider_id = ap.id
        WHERE uak.user_id = $1 AND ap.name = 'microsoft' AND uak.is_active = true
        LIMIT 1
      `, [userId]);

      if (keyResult.rows.length === 0) {
        throw new Error('Outlook API credentials not found. Please connect your Microsoft account.');
      }

      const row = keyResult.rows[0];
      const decryptedKey = EncryptionService.decrypt(row.key_data);
      const metadata = row.encrypted_metadata ? 
        JSON.parse(EncryptionService.decrypt(row.encrypted_metadata)) : {};

      // Store Outlook credentials for API calls
      this.outlook = {
        accessToken: decryptedKey,
        refreshToken: metadata.refresh_token,
        clientId: metadata.client_id,
        clientSecret: metadata.client_secret
      };

      this.currentUserId = userId;
      this.initialized = true;

      return true;
    } catch (error) {
      console.error('Error initializing Outlook service:', error);
      throw error;
    }
  }

  /**
   * Sync emails from configured providers
   * @param {number} userId - User ID
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} - Sync results
   */
  async syncEmails(userId, options = {}) {
    const { providers = ['gmail'], maxMessages = 100 } = options;
    const syncResults = {
      gmail: { synced: 0, errors: [] },
      outlook: { synced: 0, errors: [] },
      total_synced: 0,
      total_errors: 0
    };

    for (const provider of providers) {
      try {
        await this.initializeForProvider(userId, provider);
        
        if (provider === 'gmail') {
          const gmailResults = await this.syncGmailMessages(userId, maxMessages);
          syncResults.gmail = gmailResults;
          syncResults.total_synced += gmailResults.synced;
        } else if (provider === 'outlook') {
          const outlookResults = await this.syncOutlookMessages(userId, maxMessages);
          syncResults.outlook = outlookResults;
          syncResults.total_synced += outlookResults.synced;
        }
      } catch (error) {
        console.error(`Error syncing ${provider}:`, error);
        syncResults[provider].errors.push(error.message);
        syncResults.total_errors++;
      }
    }

    return syncResults;
  }

  /**
   * Sync Gmail messages
   * @param {number} userId - User ID
   * @param {number} maxResults - Maximum messages to sync
   * @returns {Promise<Object>} - Sync results
   */
  async syncGmailMessages(userId, maxResults = 100) {
    try {
      // Get sync status
      const syncResult = await pool.query(
        'SELECT history_id, last_sync_at FROM user_email_sync WHERE user_id = $1 AND provider = $2',
        [userId, 'gmail']
      );

      const lastSync = syncResult.rows[0];
      const listParams = {
        maxResults: maxResults,
        includeSpamTrash: false
      };

      // Use history API for incremental sync if available
      if (lastSync?.history_id) {
        try {
          const historyResponse = await this.gmail.users.history.list({
            userId: 'me',
            startHistoryId: lastSync.history_id,
            historyTypes: ['messageAdded', 'messageDeleted']
          });

          if (historyResponse.data.history) {
            return await this.processGmailHistory(userId, historyResponse.data.history);
          }
        } catch (historyError) {
          console.log('History API failed, falling back to full sync:', historyError.message);
        }
      }

      // Full sync
      const messagesResponse = await this.gmail.users.messages.list({
        userId: 'me',
        ...listParams
      });

      const messages = messagesResponse.data.messages || [];
      let syncedCount = 0;
      const errors = [];

      // Get current profile for history ID
      const profileResponse = await this.gmail.users.getProfile({ userId: 'me' });
      const currentHistoryId = profileResponse.data.historyId;

      for (const message of messages) {
        try {
          const fullMessage = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full'
          });

          await this.storeEmailMessage(userId, 'gmail', fullMessage.data);
          syncedCount++;
        } catch (messageError) {
          console.error(`Error processing message ${message.id}:`, messageError);
          errors.push(`Message ${message.id}: ${messageError.message}`);
        }
      }

      // Update sync status
      await this.updateSyncStatus(userId, 'gmail', {
        historyId: currentHistoryId,
        lastSyncAt: new Date()
      });

      return { synced: syncedCount, errors };
    } catch (error) {
      console.error('Error syncing Gmail messages:', error);
      throw error;
    }
  }

  /**
   * Sync Outlook messages
   * @param {number} userId - User ID
   * @param {number} maxResults - Maximum messages to sync
   * @returns {Promise<Object>} - Sync results
   */
  async syncOutlookMessages(userId, maxResults = 100) {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me/messages', {
        headers: {
          'Authorization': `Bearer ${this.outlook.accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          '$top': maxResults,
          '$select': 'id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,hasAttachments,importance,isRead',
          '$orderby': 'receivedDateTime desc'
        }
      });

      const messages = response.data.value || [];
      let syncedCount = 0;
      const errors = [];

      for (const message of messages) {
        try {
          await this.storeOutlookMessage(userId, message);
          syncedCount++;
        } catch (messageError) {
          console.error(`Error processing Outlook message ${message.id}:`, messageError);
          errors.push(`Message ${message.id}: ${messageError.message}`);
        }
      }

      // Update sync status
      await this.updateSyncStatus(userId, 'outlook', {
        lastSyncAt: new Date()
      });

      return { synced: syncedCount, errors };
    } catch (error) {
      console.error('Error syncing Outlook messages:', error);
      throw error;
    }
  }

  /**
   * Store Gmail message in database
   * @param {number} userId - User ID
   * @param {string} provider - Email provider
   * @param {Object} message - Gmail message object
   */
  async storeEmailMessage(userId, provider, message) {
    try {
      const headers = this.parseGmailHeaders(message.payload.headers);
      const body = this.extractGmailBody(message.payload);
      
      await pool.query(`
        INSERT INTO user_email_messages 
        (user_id, message_id, thread_id, provider, folder, subject, sender_email, 
         sender_name, recipient_emails, body_text, body_html, labels, is_read, 
         is_important, internal_date, sent_date, synced_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        ON CONFLICT (user_id, message_id, provider)
        DO UPDATE SET
          subject = EXCLUDED.subject,
          body_text = EXCLUDED.body_text,
          body_html = EXCLUDED.body_html,
          labels = EXCLUDED.labels,
          is_read = EXCLUDED.is_read,
          is_important = EXCLUDED.is_important,
          synced_at = NOW()
      `, [
        userId,
        message.id,
        message.threadId,
        provider,
        this.extractGmailFolder(message.labelIds),
        headers.subject || 'No Subject',
        headers.from_email,
        headers.from_name,
        [headers.to_email].filter(Boolean),
        body.text,
        body.html,
        message.labelIds || [],
        !message.labelIds?.includes('UNREAD'),
        message.labelIds?.includes('IMPORTANT') || false,
        new Date(parseInt(message.internalDate)),
        headers.date ? new Date(headers.date) : new Date(parseInt(message.internalDate))
      ]);
    } catch (error) {
      console.error('Error storing Gmail message:', error);
      throw error;
    }
  }

  /**
   * Store Outlook message in database
   * @param {number} userId - User ID
   * @param {Object} message - Outlook message object
   */
  async storeOutlookMessage(userId, message) {
    try {
      const recipientEmails = message.toRecipients?.map(r => r.emailAddress.address) || [];
      
      await pool.query(`
        INSERT INTO user_email_messages 
        (user_id, message_id, provider, folder, subject, sender_email, sender_name, 
         recipient_emails, body_text, body_html, is_read, is_important, 
         received_at, synced_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (user_id, message_id, provider)
        DO UPDATE SET
          subject = EXCLUDED.subject,
          body_text = EXCLUDED.body_text,
          body_html = EXCLUDED.body_html,
          is_read = EXCLUDED.is_read,
          is_important = EXCLUDED.is_important,
          synced_at = NOW()
      `, [
        userId,
        message.id,
        'outlook',
        'inbox', // Outlook API doesn't provide folder info in this call
        message.subject || 'No Subject',
        message.from?.emailAddress?.address,
        message.from?.emailAddress?.name,
        recipientEmails,
        message.bodyPreview,
        message.body?.content,
        message.isRead || false,
        message.importance === 'high',
        new Date(message.receivedDateTime)
      ]);
    } catch (error) {
      console.error('Error storing Outlook message:', error);
      throw error;
    }
  }

  /**
   * Get user's email messages with filtering
   * @param {number} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} - Email messages
   */
  async getMessages(userId, filters = {}) {
    try {
      const {
        provider,
        folder = 'inbox',
        is_read,
        limit = 50,
        offset = 0,
        search,
        start_date,
        end_date
      } = filters;

      let query = `
        SELECT message_id, provider, folder, subject, sender_email, sender_name,
               body_text, is_read, is_important, received_at, synced_at,
               ai_summary, ai_category, ai_sentiment
        FROM user_email_messages
        WHERE user_id = $1
      `;
      const params = [userId];
      let paramCount = 1;

      if (provider) {
        paramCount++;
        query += ` AND provider = $${paramCount}`;
        params.push(provider);
      }

      if (folder !== 'all') {
        paramCount++;
        query += ` AND folder = $${paramCount}`;
        params.push(folder);
      }

      if (is_read !== undefined) {
        paramCount++;
        query += ` AND is_read = $${paramCount}`;
        params.push(is_read);
      }

      if (search) {
        paramCount++;
        query += ` AND (subject ILIKE $${paramCount} OR body_text ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (start_date) {
        paramCount++;
        query += ` AND received_at >= $${paramCount}`;
        params.push(start_date);
      }

      if (end_date) {
        paramCount++;
        query += ` AND received_at <= $${paramCount}`;
        params.push(end_date);
      }

      query += ` ORDER BY received_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting email messages:', error);
      throw error;
    }
  }

  /**
   * Send an email
   * @param {number} userId - User ID
   * @param {Object} emailData - Email data
   * @param {string} provider - Email provider
   * @returns {Promise<Object>} - Sent message info
   */
  async sendEmail(userId, emailData, provider = 'gmail') {
    await this.initializeForProvider(userId, provider);

    try {
      const { to, cc, bcc, subject, body, attachments = [] } = emailData;

      if (provider === 'gmail') {
        return await this.sendGmailMessage(userId, emailData);
      } else if (provider === 'outlook') {
        return await this.sendOutlookMessage(userId, emailData);
      } else {
        throw new Error(`Unsupported email provider: ${provider}`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Generate AI summary for emails (Enhanced)
   * @param {number} userId - User ID
   * @param {Array} messageIds - Message IDs to summarize
   * @returns {Promise<Object>} - Summary results
   */
  async generateEmailSummaries(userId, messageIds = []) {
    try {
      const summaries = {};
      const batchSize = 10; // Process in batches to avoid rate limits

      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        
        for (const messageId of batch) {
          // Get message content
          const result = await pool.query(
            'SELECT subject, body_text, body_html, sender_email FROM user_email_messages WHERE user_id = $1 AND message_id = $2',
            [userId, messageId]
          );

          if (result.rows.length > 0) {
            const message = result.rows[0];
            
            // Enhanced categorization and analysis
            const category = this.enhancedCategorizeEmail(message);
            const sentiment = this.enhancedAnalyzeSentiment(message);
            const priority = this.analyzePriority(message);
            const actionRequired = this.detectActionRequired(message);
            
            // Create enhanced summary
            const summary = this.createEnhancedSummary(message);

            // Update message with AI analysis
            await pool.query(`
              UPDATE user_email_messages 
              SET ai_summary = $1, ai_category = $2, ai_sentiment = $3, 
                  ai_priority = $4, ai_action_required = $5, updated_at = NOW()
              WHERE user_id = $6 AND message_id = $7
            `, [summary, category, sentiment, priority, actionRequired, userId, messageId]);

            summaries[messageId] = { 
              summary, 
              category, 
              sentiment, 
              priority, 
              action_required: actionRequired,
              sender: message.sender_email
            };
          }
        }
        
        // Small delay between batches
        if (i + batchSize < messageIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return { 
        summaries, 
        processed: messageIds.length,
        enhanced_features: true
      };
    } catch (error) {
      console.error('Error generating email summaries:', error);
      throw error;
    }
  }

  /**
   * Enhanced email analysis and insights
   * @param {number} userId - User ID
   * @param {number} days - Number of days to analyze
   * @returns {Promise<Object>} - Enhanced email analytics
   */
  async getEnhancedEmailAnalytics(userId, days = 30) {
    try {
      const analytics = {
        volume_analysis: await this.analyzeEmailVolume(userId, days),
        sender_analysis: await this.analyzeSenders(userId, days),
        response_time_analysis: await this.analyzeResponseTimes(userId, days),
        productivity_insights: [],
        recommendations: []
      };

      // Generate productivity insights
      analytics.productivity_insights = this.generateProductivityInsights(analytics);
      analytics.recommendations = this.generateEmailRecommendations(analytics);

      return analytics;
    } catch (error) {
      console.error('Error getting enhanced email analytics:', error);
      throw error;
    }
  }

  /**
   * Analyze email volume patterns
   * @param {number} userId - User ID
   * @param {number} days - Number of days
   * @returns {Promise<Object>} - Volume analysis
   */
  async analyzeEmailVolume(userId, days) {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_emails,
        COUNT(CASE WHEN ai_priority = 'high' THEN 1 END) as high_priority,
        COUNT(CASE WHEN ai_action_required = true THEN 1 END) as action_required,
        DATE_TRUNC('day', received_at) as date,
        COUNT(*) as daily_count
      FROM user_email_messages
      WHERE user_id = $1 
        AND received_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE_TRUNC('day', received_at)
      ORDER BY date DESC
    `, [userId]);

    const dailyVolume = result.rows;
    const totalStats = {
      total_emails: dailyVolume.reduce((sum, day) => sum + parseInt(day.daily_count), 0),
      avg_daily: Math.round(dailyVolume.reduce((sum, day) => sum + parseInt(day.daily_count), 0) / days),
      peak_day: dailyVolume.reduce((max, day) => 
        parseInt(day.daily_count) > parseInt(max.daily_count || 0) ? day : max, {})
    };

    return { daily_volume: dailyVolume, stats: totalStats };
  }

  /**
   * Analyze sender patterns
   * @param {number} userId - User ID
   * @param {number} days - Number of days
   * @returns {Promise<Object>} - Sender analysis
   */
  async analyzeSenders(userId, days) {
    const result = await pool.query(`
      SELECT 
        sender_email,
        sender_name,
        COUNT(*) as email_count,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count,
        AVG(CASE WHEN ai_priority = 'high' THEN 3 WHEN ai_priority = 'medium' THEN 2 ELSE 1 END) as avg_priority
      FROM user_email_messages
      WHERE user_id = $1 
        AND received_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY sender_email, sender_name
      ORDER BY email_count DESC
      LIMIT 20
    `, [userId]);

    return {
      top_senders: result.rows,
      unique_senders: result.rows.length
    };
  }

  /**
   * Enhanced email categorization
   * @param {Object} message - Email message
   * @returns {string} - Enhanced category
   */
  enhancedCategorizeEmail(message) {
    const subject = (message.subject || '').toLowerCase();
    const body = (message.body_text || '').toLowerCase();
    const sender = (message.sender_email || '').toLowerCase();
    const content = `${subject} ${body}`;

    // Work/Business patterns
    if (content.match(/\b(meeting|calendar|appointment|schedule|conference|call)\b/) ||
        content.match(/\b(project|deadline|task|assignment|deliverable)\b/) ||
        content.match(/\b(proposal|contract|agreement|invoice|budget)\b/)) {
      return 'work';
    }
    
    // Finance patterns
    if (content.match(/\b(payment|bill|invoice|statement|account|transaction)\b/) ||
        content.match(/\b(bank|credit|debit|balance|transfer)\b/) ||
        sender.match(/\b(bank|payment|billing|finance)\b/)) {
      return 'finance';
    }
    
    // Travel patterns
    if (content.match(/\b(flight|hotel|booking|reservation|trip|travel)\b/) ||
        content.match(/\b(airline|airport|destination|itinerary)\b/) ||
        sender.match(/\b(booking|travel|airline|hotel)\b/)) {
      return 'travel';
    }
    
    // Shopping patterns
    if (content.match(/\b(order|purchase|delivery|shipped|tracking)\b/) ||
        content.match(/\b(cart|checkout|discount|sale|promotion)\b/) ||
        sender.match(/\b(amazon|ebay|shop|store|retail)\b/)) {
      return 'shopping';
    }
    
    // Newsletter/Marketing patterns
    if (content.match(/\b(newsletter|unsubscribe|digest|update|news)\b/) ||
        content.match(/\b(marketing|promotion|offer|deal)\b/) ||
        sender.match(/\b(newsletter|marketing|promo|news)\b/)) {
      return 'newsletter';
    }
    
    // Social/Personal patterns
    if (content.match(/\b(family|friend|birthday|anniversary|personal)\b/) ||
        content.match(/\b(facebook|twitter|instagram|linkedin|social)\b/) ||
        sender.match(/\b(facebook|twitter|instagram|linkedin)\b/)) {
      return 'social';
    }
    
    return 'general';
  }

  /**
   * Enhanced sentiment analysis
   * @param {Object} message - Email message
   * @returns {string} - Enhanced sentiment
   */
  enhancedAnalyzeSentiment(message) {
    const content = `${message.subject || ''} ${message.body_text || ''}`.toLowerCase();
    
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'perfect', 'thanks', 'congratulations', 'success'];
    const negativeWords = ['urgent', 'problem', 'issue', 'error', 'failed', 'wrong', 'hate', 'disappointed', 'concern', 'complaint'];
    const neutralWords = ['meeting', 'update', 'information', 'notification', 'reminder', 'request'];
    
    const positiveCount = positiveWords.filter(word => content.includes(word)).length;
    const negativeCount = negativeWords.filter(word => content.includes(word)).length;
    const neutralCount = neutralWords.filter(word => content.includes(word)).length;
    
    if (negativeCount > 0 && negativeCount > positiveCount) return 'negative';
    if (positiveCount > 0 && positiveCount > negativeCount) return 'positive';
    if (neutralCount > 0) return 'neutral';
    
    return 'neutral';
  }

  /**
   * Analyze email priority
   * @param {Object} message - Email message
   * @returns {string} - Priority level
   */
  analyzePriority(message) {
    const subject = (message.subject || '').toLowerCase();
    const body = (message.body_text || '').toLowerCase();
    const content = `${subject} ${body}`;
    const sender = (message.sender_email || '').toLowerCase();

    // High priority indicators
    if (content.match(/\b(urgent|asap|immediately|critical|emergency)\b/) ||
        content.match(/\b(deadline|overdue|late|final notice)\b/) ||
        subject.match(/^(re:|fwd:|urgent|important)/)) {
      return 'high';
    }
    
    // Medium priority indicators
    if (content.match(/\b(meeting|appointment|schedule|call)\b/) ||
        content.match(/\b(project|task|assignment|deliverable)\b/) ||
        sender.match(/\b(boss|manager|director|ceo|president)\b/)) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Detect if action is required
   * @param {Object} message - Email message
   * @returns {boolean} - Action required
   */
  detectActionRequired(message) {
    const content = `${message.subject || ''} ${message.body_text || ''}`.toLowerCase();
    
    const actionWords = [
      'please', 'can you', 'could you', 'would you', 'need you to',
      'request', 'required', 'must', 'should', 'deadline',
      'respond', 'reply', 'confirm', 'approve', 'review',
      'action', 'task', 'assignment', 'deliverable'
    ];
    
    return actionWords.some(word => content.includes(word));
  }

  /**
   * Create enhanced email summary
   * @param {Object} message - Email message
   * @returns {string} - Enhanced summary
   */
  createEnhancedSummary(message) {
    const subject = message.subject || 'No Subject';
    const bodyText = message.body_text || '';
    
    // Extract key information
    const hasDeadline = /\b(deadline|due|by|before)\s+(\w+\s+\d+|\d+\/\d+|\d+-\d+)\b/.test(bodyText.toLowerCase());
    const hasMeeting = /\b(meeting|call|conference)\b/.test(bodyText.toLowerCase());
    const hasAttachment = message.has_attachments;
    
    let summary = `Email from ${message.sender_email}: "${subject}"`;
    
    if (bodyText.length > 100) {
      const excerpt = bodyText.substring(0, 150).trim() + '...';
      summary += ` - ${excerpt}`;
    }
    
    // Add context clues
    const context = [];
    if (hasDeadline) context.push('Contains deadline');
    if (hasMeeting) context.push('Meeting/call related');
    if (hasAttachment) context.push('Has attachments');
    
    if (context.length > 0) {
      summary += ` [${context.join(', ')}]`;
    }
    
    return summary;
  }

  /**
   * Update sync status for a provider
   * @param {number} userId - User ID
   * @param {string} provider - Email provider
   * @param {Object} status - Status data
   */
  async updateSyncStatus(userId, provider, status) {
    try {
      await pool.query(`
        INSERT INTO user_email_sync (user_id, provider, email_address, history_id, last_sync_at)
        VALUES ($1, $2, 'user@example.com', $3, $4)
        ON CONFLICT (user_id, provider, email_address)
        DO UPDATE SET
          history_id = EXCLUDED.history_id,
          last_sync_at = EXCLUDED.last_sync_at
      `, [userId, provider, status.historyId, status.lastSyncAt]);
    } catch (error) {
      console.error('Error updating sync status:', error);
      throw error;
    }
  }

  /**
   * Helper: Parse Gmail headers
   * @param {Array} headers - Gmail headers array
   * @returns {Object} - Parsed headers
   */
  parseGmailHeaders(headers) {
    const parsed = {};
    
    headers.forEach(header => {
      const name = header.name.toLowerCase();
      
      if (name === 'from') {
        const fromMatch = header.value.match(/^(.+?)\s*<(.+?)>$/) || [null, header.value, header.value];
        parsed.from_name = fromMatch[1]?.trim().replace(/"/g, '') || '';
        parsed.from_email = fromMatch[2]?.trim() || header.value;
      } else if (name === 'to') {
        parsed.to_email = header.value;
      } else if (name === 'subject') {
        parsed.subject = header.value;
      } else if (name === 'date') {
        parsed.date = header.value;
      }
    });

    return parsed;
  }

  /**
   * Helper: Extract Gmail message body
   * @param {Object} payload - Gmail message payload
   * @returns {Object} - Extracted body
   */
  extractGmailBody(payload) {
    const body = { text: '', html: '' };

    const extractFromPart = (part) => {
      if (part.mimeType === 'text/plain' && part.body.data) {
        body.text += Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body.data) {
        body.html += Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    if (payload.parts) {
      payload.parts.forEach(extractFromPart);
    } else if (payload.body.data) {
      extractFromPart(payload);
    }

    return body;
  }

  /**
   * Helper: Extract folder from Gmail labels
   * @param {Array} labelIds - Gmail label IDs
   * @returns {string} - Folder name
   */
  extractGmailFolder(labelIds = []) {
    if (labelIds.includes('INBOX')) return 'inbox';
    if (labelIds.includes('SENT')) return 'sent';
    if (labelIds.includes('DRAFT')) return 'draft';
    if (labelIds.includes('TRASH')) return 'trash';
    if (labelIds.includes('SPAM')) return 'spam';
    return 'inbox';
  }

  /**
   * Helper: Simple email categorization
   * @param {Object} message - Email message
   * @returns {string} - Category
   */
  categorizeEmail(message) {
    const subject = (message.subject || '').toLowerCase();
    const body = (message.body_text || '').toLowerCase();
    const content = `${subject} ${body}`;

    if (content.includes('meeting') || content.includes('calendar') || content.includes('appointment')) {
      return 'meeting';
    } else if (content.includes('invoice') || content.includes('payment') || content.includes('bill')) {
      return 'finance';
    } else if (content.includes('travel') || content.includes('flight') || content.includes('hotel')) {
      return 'travel';
    } else if (content.includes('project') || content.includes('deadline') || content.includes('task')) {
      return 'work';
    } else {
      return 'general';
    }
  }

  /**
   * Helper: Simple sentiment analysis
   * @param {Object} message - Email message
   * @returns {string} - Sentiment
   */
  analyzeSentiment(message) {
    const content = `${message.subject || ''} ${message.body_text || ''}`.toLowerCase();
    
    const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'perfect'];
    const negativeWords = ['urgent', 'problem', 'issue', 'error', 'failed', 'wrong', 'hate'];
    
    const positiveCount = positiveWords.filter(word => content.includes(word)).length;
    const negativeCount = negativeWords.filter(word => content.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Generate productivity insights
   * @param {Object} analytics - Email analytics data
   * @returns {Array} - Productivity insights
   */
  generateProductivityInsights(analytics) {
    const insights = [];
    
    if (analytics.volume_analysis?.stats?.avg_daily > 50) {
      insights.push({
        type: 'high_volume',
        priority: 'medium',
        message: `You receive ${analytics.volume_analysis.stats.avg_daily} emails per day on average. Consider email filters and batching.`,
        avg_daily: analytics.volume_analysis.stats.avg_daily
      });
    }
    
    if (analytics.sender_analysis?.top_senders?.length > 0) {
      const topSender = analytics.sender_analysis.top_senders[0];
      if (topSender.email_count > 20) {
        insights.push({
          type: 'frequent_sender',
          priority: 'low',
          message: `${topSender.sender_email} sends you ${topSender.email_count} emails frequently. Consider setting up filters.`,
          sender: topSender.sender_email,
          count: topSender.email_count
        });
      }
    }
    
    return insights;
  }

  /**
   * Generate email recommendations
   * @param {Object} analytics - Email analytics data
   * @returns {Array} - Email recommendations
   */
  generateEmailRecommendations(analytics) {
    const recommendations = [];
    
    recommendations.push({
      type: 'inbox_zero',
      message: 'Schedule dedicated time slots for email processing to maintain inbox zero.',
      priority: 'medium'
    });
    
    recommendations.push({
      type: 'email_filters',
      message: 'Set up filters for newsletters and automated emails to reduce noise.',
      priority: 'low'
    });
    
    recommendations.push({
      type: 'response_templates',
      message: 'Create templates for common responses to save time.',
      priority: 'low'
    });
    
    return recommendations;
  }

  /**
   * Analyze response times (placeholder)
   * @param {number} userId - User ID
   * @param {number} days - Number of days
   * @returns {Promise<Object>} - Response time analysis
   */
  async analyzeResponseTimes(userId, days) {
    // This would require tracking sent emails and correlating with received emails
    // For now, return placeholder data
    return {
      avg_response_time_hours: 24,
      fastest_response_minutes: 15,
      slowest_response_days: 7,
      response_rate_percentage: 85
    };
  }

  /**
   * Test email API connectivity
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Test results
   */
  async testConnectivity(userId) {
    try {
      await this.initializeGmail(userId);
      
      // Test basic Gmail access
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      
      return {
        success: true,
        email_address: profile.data.emailAddress,
        messages_total: profile.data.messagesTotal || 0,
        threads_total: profile.data.threadsTotal || 0,
        enhanced_features_available: true,
        message: 'Gmail API connectivity verified'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        enhanced_features_available: false,
        message: 'Gmail API connectivity failed'
      };
    }
  }

  /**
   * Get service status
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      service: 'EmailService',
      version: '2.0-enhanced',
      initialized: this.initialized,
      current_user: this.currentUserId || null,
      google_api_service: this.googleAPI ? 'connected' : 'disconnected',
      providers: {
        gmail: !!this.gmail,
        outlook: !!this.outlook
      },
      features: {
        basic_email_sync: true,
        ai_categorization: true,
        sentiment_analysis: true,
        priority_detection: true,
        action_detection: true,
        productivity_insights: true,
        enhanced_analytics: true
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new EmailService();
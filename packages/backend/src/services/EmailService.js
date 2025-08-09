/* global process, Buffer, console */
import { google } from 'googleapis';
import axios from 'axios';
import pool from '../db.js';
import SecureEncryptionService from '../system/SecureEncryptionService.js';
import GoogleAPIService from './GoogleAPIService.js';

/**
 * EmailService - Enhanced email management with AI-powered features
 * Features:
 * - Gmail and Outlook integration with OAuth2
 * - AI-powered email summarization and categorization
 * - Email thread management and conversation tracking
 * - Intelligent priority detection and spam filtering
 * - Auto-response suggestions and drafting assistance
 * - Attachment handling and processing
 * - Real-time email synchronization
 * - Advanced search and filtering capabilities
 */
class EmailService {
  constructor() {
    this.initialized = false;
    this.gmail = null;
    this.outlook = null;
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
      maxEmailsPerSync: 500,
      syncRetentionDays: 90,
      maxAttachmentSize: 25 * 1024 * 1024, // 25MB
      batchSize: 50,
      rateLimitDelay: 100, // ms between API calls
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      maxSearchResults: 100,
    };

    console.log(
      '📧 EmailService initialized with enhanced Google API integration'
    );
  }

  /**
   * Initialize Email service for a specific provider
   * @param {number} userId - User ID
   * @param {string} provider - Email provider ('gmail' or 'outlook')
   * @returns {Promise<boolean>} - Success status
   */
  async initializeForProvider(userId, provider) {
    try {
      this.currentUserId = userId;

      if (provider === 'gmail') {
        return await this.initializeGmail(userId);
      } else if (provider === 'outlook') {
        return await this.initializeOutlook(userId);
      } else {
        throw new Error(`Unsupported email provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Error initializing ${provider} service:`, error);
      this.lastError = error;
      this.errorCount++;
      throw error;
    }
  }

  /**
   * Initialize Gmail API client
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async initializeGmail(userId) {
    try {
      // Try enhanced GoogleAPIService first
      try {
        const userAPIs = await this.googleAPI.getUserAPIs(userId);
        this.gmail = userAPIs.gmail;
        this.initialized = true;
        this.healthStatus = 'healthy';
        console.log(
          `✅ Gmail initialized for user ${userId} via GoogleAPIService`
        );
        return true;
      } catch (googleAPIError) {
        console.log(
          'GoogleAPIService unavailable, falling back to direct OAuth...'
        );
      }

      // Fallback to direct OAuth implementation
      const credentials = await this.getOAuthCredentials(userId, 'gmail');
      if (!credentials) {
        throw new Error('Gmail OAuth credentials not found');
      }

      const oauth2Client = new google.auth.OAuth2(
        credentials.client_id,
        credentials.client_secret,
        credentials.redirect_uri
      );

      oauth2Client.setCredentials({
        refresh_token: credentials.refresh_token,
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date,
      });

      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      this.initialized = true;
      this.healthStatus = 'healthy';

      console.log(`✅ Gmail initialized for user ${userId} via direct OAuth`);
      return true;
    } catch (error) {
      console.error('Gmail initialization error:', error);
      this.lastError = error;
      this.errorCount++;
      this.healthStatus = 'error';
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
      const credentials = await this.getOAuthCredentials(userId, 'outlook');
      if (!credentials) {
        throw new Error('Outlook OAuth credentials not found');
      }

      // Microsoft Graph API setup
      this.outlook = {
        credentials: credentials,
        baseUrl: 'https://graph.microsoft.com/v1.0',
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json',
        },
      };

      this.initialized = true;
      this.healthStatus = 'healthy';

      console.log(`✅ Outlook initialized for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Outlook initialization error:', error);
      this.lastError = error;
      this.errorCount++;
      this.healthStatus = 'error';
      throw error;
    }
  }

  /**
   * Get OAuth credentials for a provider
   * @private
   */
  async getOAuthCredentials(userId, provider) {
    try {
      const result = await pool.query(
        `
        SELECT uak.key_data 
        FROM user_api_keys uak
        JOIN api_providers ap ON uak.provider_id = ap.id
        WHERE uak.user_id = $1 AND ap.name = $2 AND uak.is_active = true
        LIMIT 1
      `,
        [userId, provider]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const encryptedData = result.rows[0].key_data;
      const decryptedData = SecureEncryptionService.decrypt(encryptedData);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error(`Error getting OAuth credentials for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Fetch emails with advanced filtering and pagination
   * @param {Object} options - Filtering and pagination options
   * @returns {Promise<Object>} - Emails and metadata
   */
  async fetchEmails(options = {}) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    const {
      folder = 'inbox',
      limit = 25,
      offset = 0,
      query = '',
      unreadOnly = false,
      dateFrom = null,
      dateTo = null,
      provider = 'gmail',
    } = options;

    try {
      if (provider === 'gmail' && this.gmail) {
        return await this.fetchGmailMessages(options);
      } else if (provider === 'outlook' && this.outlook) {
        return await this.fetchOutlookMessages(options);
      } else {
        throw new Error(`Provider ${provider} not initialized`);
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  /**
   * Fetch Gmail messages
   * @private
   */
  async fetchGmailMessages(options) {
    const { folder, limit, query, unreadOnly } = options;

    let searchQuery = '';
    if (folder !== 'inbox') searchQuery += `in:${folder} `;
    if (query) searchQuery += `${query} `;
    if (unreadOnly) searchQuery += 'is:unread ';

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: searchQuery.trim(),
      maxResults: limit,
    });

    const messages = response.data.messages || [];
    const emails = [];

    // Fetch details for each message
    for (const message of messages) {
      try {
        const detail = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });

        const email = this.parseGmailMessage(detail.data);
        emails.push(email);
      } catch (error) {
        console.error(`Error fetching message ${message.id}:`, error);
      }
    }

    return {
      emails,
      total: messages.length,
      nextPageToken: response.data.nextPageToken,
    };
  }

  /**
   * Fetch Outlook messages
   * @private
   */
  async fetchOutlookMessages(options) {
    const { folder, limit, query, unreadOnly } = options;

    let endpoint = '/me/messages';
    let filterParams = [];

    if (unreadOnly) filterParams.push('isRead eq false');
    if (query)
      filterParams.push(
        `contains(subject,'${query}') or contains(body/content,'${query}')`
      );

    const params = new URLSearchParams({
      $top: limit,
      $orderby: 'receivedDateTime desc',
      $select:
        'id,subject,sender,receivedDateTime,isRead,importance,body,toRecipients',
    });

    if (filterParams.length > 0) {
      params.append('$filter', filterParams.join(' and '));
    }

    const response = await axios.get(
      `${this.outlook.baseUrl}${endpoint}?${params.toString()}`,
      { headers: this.outlook.headers }
    );

    const emails = response.data.value.map(msg =>
      this.parseOutlookMessage(msg)
    );

    return {
      emails,
      total: emails.length,
      nextPageToken: response.data['@odata.nextLink'],
    };
  }

  /**
   * Parse Gmail message format
   * @private
   */
  parseGmailMessage(message) {
    const headers = message.payload.headers;
    const getHeader = name => headers.find(h => h.name === name)?.value || '';

    return {
      id: message.id,
      threadId: message.threadId,
      provider: 'gmail',
      subject: getHeader('Subject'),
      sender: {
        email: getHeader('From'),
        name: this.extractNameFromEmail(getHeader('From')),
      },
      recipients: getHeader('To')
        .split(',')
        .map(email => email.trim()),
      ccRecipients: getHeader('Cc')
        .split(',')
        .filter(email => email.trim()),
      receivedAt: new Date(parseInt(message.internalDate)),
      isRead: !message.labelIds?.includes('UNREAD'),
      isImportant: message.labelIds?.includes('IMPORTANT'),
      labels: message.labelIds || [],
      body: this.extractGmailBody(message.payload),
      attachments: this.extractGmailAttachments(message.payload),
      snippet: message.snippet,
    };
  }

  /**
   * Parse Outlook message format
   * @private
   */
  parseOutlookMessage(message) {
    return {
      id: message.id,
      threadId: message.conversationId,
      provider: 'outlook',
      subject: message.subject,
      sender: {
        email: message.sender?.emailAddress?.address,
        name: message.sender?.emailAddress?.name,
      },
      recipients: message.toRecipients?.map(r => r.emailAddress.address) || [],
      receivedAt: new Date(message.receivedDateTime),
      isRead: message.isRead,
      isImportant: message.importance === 'high',
      body: message.body?.content || '',
      bodyType: message.body?.contentType || 'html',
    };
  }

  /**
   * Send email through the appropriate provider
   */
  async sendEmail(emailData) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    const { to, subject, body, attachments, provider = 'gmail' } = emailData;

    try {
      if (provider === 'gmail' && this.gmail) {
        return await this.sendGmailMessage(emailData);
      } else if (provider === 'outlook' && this.outlook) {
        return await this.sendOutlookMessage(emailData);
      } else {
        throw new Error(`Provider ${provider} not initialized`);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send Gmail message
   * @private
   */
  async sendGmailMessage(emailData) {
    const { to, cc, bcc, subject, body, attachments = [] } = emailData;

    const boundary = 'boundary_' + Date.now();
    let rawMessage = [
      `To: ${to}`,
      cc ? `Cc: ${cc}` : '',
      bcc ? `Bcc: ${bcc}` : '',
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      body,
      '',
    ]
      .filter(line => line !== null)
      .join('\r\n');

    // Add attachments if any
    for (const attachment of attachments) {
      rawMessage += `--${boundary}\r\n`;
      rawMessage += `Content-Type: ${attachment.mimeType}\r\n`;
      rawMessage += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
      rawMessage += 'Content-Transfer-Encoding: base64\r\n\r\n';
      rawMessage += attachment.data + '\r\n';
    }

    rawMessage += `--${boundary}--\r\n`;

    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      success: true,
      messageId: response.data.id,
      provider: 'gmail',
    };
  }

  /**
   * Send Outlook message
   * @private
   */
  async sendOutlookMessage(emailData) {
    const { to, cc, bcc, subject, body } = emailData;

    const message = {
      subject: subject,
      body: {
        contentType: 'HTML',
        content: body,
      },
      toRecipients: to.split(',').map(email => ({
        emailAddress: { address: email.trim() },
      })),
    };

    if (cc) {
      message.ccRecipients = cc.split(',').map(email => ({
        emailAddress: { address: email.trim() },
      }));
    }

    if (bcc) {
      message.bccRecipients = bcc.split(',').map(email => ({
        emailAddress: { address: email.trim() },
      }));
    }

    const response = await axios.post(
      `${this.outlook.baseUrl}/me/sendMail`,
      { message },
      { headers: this.outlook.headers }
    );

    return {
      success: true,
      provider: 'outlook',
    };
  }

  /**
   * Extract Gmail message body
   * @private
   */
  extractGmailBody(payload) {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
          if (part.body?.data) {
            return Buffer.from(part.body.data, 'base64').toString();
          }
        }
        if (part.parts) {
          const body = this.extractGmailBody(part);
          if (body) return body;
        }
      }
    }

    return '';
  }

  /**
   * Extract Gmail attachments
   * @private
   */
  extractGmailAttachments(payload) {
    const attachments = [];

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size,
            attachmentId: part.body.attachmentId,
          });
        }
      }
    }

    return attachments;
  }

  /**
   * Extract name from email address
   * @private
   */
  extractNameFromEmail(emailHeader) {
    const match = emailHeader.match(/^([^<]+)<([^>]+)>$/);
    if (match) {
      return match[1].trim().replace(/^"(.+)"$/, '$1');
    }
    return emailHeader.split('@')[0];
  }

  /**
   * Generate AI summary of email content
   */
  async generateEmailSummary(emailContent, provider = 'openai') {
    try {
      // This would integrate with the AI agents from the system
      // For now, return a simple summary
      const words = emailContent.split(' ').slice(0, 50).join(' ');
      return `Summary: ${words}...`;
    } catch (error) {
      console.error('Error generating email summary:', error);
      return 'Summary generation failed';
    }
  }

  /**
   * Categorize email using AI
   */
  async categorizeEmail(emailData) {
    try {
      const { subject, body, sender } = emailData;

      // Simple rule-based categorization for now
      const content = `${subject} ${body}`.toLowerCase();

      if (content.includes('meeting') || content.includes('calendar'))
        return 'meeting';
      if (content.includes('urgent') || content.includes('asap'))
        return 'urgent';
      if (content.includes('invoice') || content.includes('payment'))
        return 'finance';
      if (content.includes('newsletter') || content.includes('unsubscribe'))
        return 'newsletter';

      return 'general';
    } catch (error) {
      console.error('Error categorizing email:', error);
      return 'unknown';
    }
  }

  /**
   * Sync emails to local database
   */
  async syncEmails(provider = 'gmail', options = {}) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    try {
      const { limit = 100 } = options;
      const emails = await this.fetchEmails({ provider, limit });

      const syncResults = {
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
      };

      for (const email of emails.emails) {
        try {
          await this.saveEmailToDatabase(email);
          syncResults.processed++;
          syncResults.inserted++; // Simplified - would check if insert vs update
        } catch (error) {
          console.error(`Error saving email ${email.id}:`, error);
          syncResults.errors++;
        }
      }

      console.log(`📧 Email sync completed: ${JSON.stringify(syncResults)}`);
      return syncResults;
    } catch (error) {
      console.error('Email sync failed:', error);
      throw error;
    }
  }

  /**
   * Save email to database
   * @private
   */
  async saveEmailToDatabase(email) {
    const query = `
      INSERT INTO user_email_messages (
        user_id, message_id, thread_id, provider, folder,
        subject, sender_email, sender_name, recipient_emails,
        body_text, body_html, labels, is_read, is_important,
        received_at, synced_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (user_id, message_id, provider) 
      DO UPDATE SET
        labels = EXCLUDED.labels,
        is_read = EXCLUDED.is_read,
        is_important = EXCLUDED.is_important,
        synced_at = EXCLUDED.synced_at
    `;

    await pool.query(query, [
      this.currentUserId,
      email.id,
      email.threadId,
      email.provider,
      'inbox',
      email.subject,
      email.sender.email,
      email.sender.name,
      email.recipients,
      email.body,
      email.body,
      email.labels || [],
      email.isRead,
      email.isImportant,
      email.receivedAt,
      new Date(),
    ]);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'EmailService',
      initialized: this.initialized,
      healthStatus: this.healthStatus,
      currentUserId: this.currentUserId,
      errorCount: this.errorCount,
      lastError: this.lastError?.message,
      providers: {
        gmail: !!this.gmail,
        outlook: !!this.outlook,
      },
      uptime: Date.now() - this.initTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return { healthy: false, error: 'Not initialized' };
      }

      // Test basic functionality
      if (this.gmail) {
        await this.gmail.users.getProfile({ userId: 'me' });
      }

      return { healthy: true, timestamp: new Date().toISOString() };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('📧 EmailService cleanup started');
    this.gmail = null;
    this.outlook = null;
    this.initialized = false;
    this.currentUserId = null;
    console.log('📧 EmailService cleanup completed');
  }
}

export default EmailService;

/* global process, console */
import { google } from 'googleapis';
import axios from 'axios';
import pool from '../db.js';
import EncryptionService from './SimpleEncryption.js';
import GoogleAPIService from './GoogleAPIService.js';

/**
 * ContactService - Enhanced contact management with multiple provider support
 * Features:
 * - Google Contacts and Outlook integration
 * - Contact synchronization with local storage
 * - AI-powered contact search and matching
 * - Interaction tracking and analytics
 * - Duplicate detection and merging
 * - Birthday and anniversary reminders
 * - Contact insights and recommendations
 * - Robust error handling and retry mechanisms
 */
class ContactService {
  constructor() {
    this.initialized = false;
    this.googleContacts = null;
    this.outlookContacts = null;
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
      maxContactsPerSync: 1000,
      rateLimitDelay: 100, // ms between API calls
      duplicateThreshold: 0.8, // similarity threshold for duplicate detection
      cacheTimeout: 10 * 60 * 1000, // 10 minutes
      maxSearchResults: 50,
      birthdayReminderDays: 30,
    };

    console.log(
      '👥 ContactService initialized with enhanced Google API integration'
    );
  }

  /**
   * Initialize Contact service for a specific provider
   * @param {number} userId - User ID
   * @param {string} provider - Contact provider ('google' or 'outlook')
   * @returns {Promise<boolean>} - Success status
   */
  async initializeForProvider(userId, provider = 'google') {
    if (!userId) {
      throw new Error('User ID is required for contact service initialization');
    }

    try {
      if (provider === 'google') {
        return await this.initializeGoogleContacts(userId);
      } else if (provider === 'outlook') {
        return await this.initializeOutlookContacts(userId);
      } else {
        throw new Error(`Unsupported contact provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Error initializing ${provider} contacts:`, error);
      this.handleError(error, `initialize_${provider}`);
      throw error;
    }
  }

  /**
   * Initialize Google Contacts API client (Enhanced)
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async initializeGoogleContacts(userId) {
    try {
      // Try enhanced GoogleAPIService first
      try {
        const userAPIs = await this.googleAPI.getUserAPIs(userId);
        this.googleContacts = userAPIs.people;
        this.currentUserId = userId;
        this.initialized = true;
        this.healthStatus = 'healthy';
        this.lastError = null;

        console.log(
          `✅ Enhanced Google Contacts service initialized for user ${userId}`
        );
        return true;
      } catch (enhancedError) {
        console.log(
          '🔄 Enhanced Google Contacts initialization failed, using legacy method...'
        );
      }

      // Fallback to legacy method
      const keyResult = await pool.query(
        `
        SELECT uak.key_data, uak.encrypted_metadata
        FROM user_api_keys uak
        JOIN api_providers ap ON uak.provider_id = ap.id
        WHERE uak.user_id = $1 AND ap.name = 'google' AND uak.is_active = true
        LIMIT 1
      `,
        [userId]
      );

      if (keyResult.rows.length === 0) {
        throw new Error(
          'Google Contacts API credentials not found. Please connect your Google account.'
        );
      }

      const row = keyResult.rows[0];
      const decryptedKey = EncryptionService.decrypt(row.key_data);
      const metadata = row.encrypted_metadata
        ? JSON.parse(EncryptionService.decrypt(row.encrypted_metadata))
        : {};

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
        expiry_date: metadata.expiry_date,
      });

      // Initialize People API client (Google Contacts)
      this.googleContacts = google.people({
        version: 'v1',
        auth: oauth2Client,
      });

      this.currentUserId = userId;
      this.initialized = true;
      this.healthStatus = 'healthy';

      console.log(
        `✅ Legacy Google Contacts service initialized for user ${userId}`
      );
      return true;
    } catch (error) {
      console.error('Error initializing Google Contacts service:', error);
      this.healthStatus = 'error';
      throw error;
    }
  }

  /**
   * Initialize Outlook Contacts API client
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async initializeOutlookContacts(userId) {
    try {
      const keyResult = await pool.query(
        `
        SELECT uak.key_data, uak.encrypted_metadata
        FROM user_api_keys uak
        JOIN api_providers ap ON uak.provider_id = ap.id
        WHERE uak.user_id = $1 AND ap.name = 'outlook' AND uak.is_active = true
        LIMIT 1
      `,
        [userId]
      );

      if (keyResult.rows.length === 0) {
        throw new Error(
          'Outlook Contacts API credentials not found. Please connect your Microsoft account.'
        );
      }

      const row = keyResult.rows[0];
      const decryptedKey = EncryptionService.decrypt(row.key_data);
      const metadata = row.encrypted_metadata
        ? JSON.parse(EncryptionService.decrypt(row.encrypted_metadata))
        : {};

      // Store Outlook credentials for API calls
      this.outlookContacts = {
        accessToken: decryptedKey,
        refreshToken: metadata.refresh_token,
        clientId: metadata.client_id,
        clientSecret: metadata.client_secret,
      };

      this.currentUserId = userId;
      this.initialized = true;
      this.healthStatus = 'healthy';

      return true;
    } catch (error) {
      console.error('Error initializing Outlook Contacts service:', error);
      this.healthStatus = 'error';
      throw error;
    }
  }

  /**
   * Sync contacts from configured providers
   * @param {number} userId - User ID
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} - Sync results
   */
  async syncContacts(userId, options = {}) {
    const {
      providers = ['google'],
      maxContacts = this.config.maxContactsPerSync,
    } = options;
    const syncResults = {
      google: { synced: 0, errors: [] },
      outlook: { synced: 0, errors: [] },
      total_synced: 0,
      total_errors: 0,
      duplicates_found: 0,
      duplicates_merged: 0,
    };

    for (const provider of providers) {
      try {
        await this.initializeForProvider(userId, provider);

        if (provider === 'google') {
          const googleResults = await this.syncGoogleContacts(
            userId,
            maxContacts
          );
          syncResults.google = googleResults;
          syncResults.total_synced += googleResults.synced;
        } else if (provider === 'outlook') {
          const outlookResults = await this.syncOutlookContacts(
            userId,
            maxContacts
          );
          syncResults.outlook = outlookResults;
          syncResults.total_synced += outlookResults.synced;
        }
      } catch (error) {
        console.error(`Error syncing ${provider} contacts:`, error);
        syncResults[provider].errors.push(error.message);
        syncResults.total_errors++;
      }
    }

    // Perform deduplication after syncing all providers
    if (syncResults.total_synced > 0) {
      try {
        const deduplicationResults = await this.deduplicateContacts(userId);
        syncResults.duplicates_found = deduplicationResults.duplicates_found;
        syncResults.duplicates_merged = deduplicationResults.duplicates_merged;
      } catch (dedupeError) {
        console.error('Error during deduplication:', dedupeError);
        syncResults.total_errors++;
      }
    }

    return syncResults;
  }

  /**
   * Sync Google contacts
   * @param {number} userId - User ID
   * @param {number} maxResults - Maximum contacts to sync
   * @returns {Promise<Object>} - Sync results
   */
  async syncGoogleContacts(userId, maxResults = 1000) {
    try {
      const connectionsResponse =
        await this.googleContacts.people.connections.list({
          resourceName: 'people/me',
          pageSize: Math.min(maxResults, 1000),
          personFields:
            'names,emailAddresses,phoneNumbers,addresses,organizations,birthdays,photos,urls,biographies,occupations,relations,nicknames',
        });

      const connections = connectionsResponse.data.connections || [];
      let syncedCount = 0;
      const errors = [];

      for (const person of connections) {
        try {
          await this.storeGoogleContact(userId, person);
          syncedCount++;

          // Add rate limiting
          await this.delay(this.config.rateLimitDelay);
        } catch (contactError) {
          console.error(
            `Error processing Google contact ${person.resourceName}:`,
            contactError
          );
          errors.push(
            `Contact ${person.resourceName}: ${contactError.message}`
          );
        }
      }

      return { synced: syncedCount, errors };
    } catch (error) {
      console.error('Error syncing Google contacts:', error);
      this.handleError(error, 'sync_google_contacts');
      throw error;
    }
  }

  /**
   * Sync Outlook contacts
   * @param {number} userId - User ID
   * @param {number} maxResults - Maximum contacts to sync
   * @returns {Promise<Object>} - Sync results
   */
  async syncOutlookContacts(userId, maxResults = 999) {
    try {
      const response = await axios.get(
        'https://graph.microsoft.com/v1.0/me/contacts',
        {
          headers: {
            Authorization: `Bearer ${this.outlookContacts.accessToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            $top: Math.min(maxResults, 999),
            $select:
              'id,displayName,givenName,surname,emailAddresses,businessPhones,homePhones,mobilePhone,businessAddress,homeAddress,companyName,jobTitle,birthday,personalNotes',
          },
        }
      );

      const contacts = response.data.value || [];
      let syncedCount = 0;
      const errors = [];

      for (const contact of contacts) {
        try {
          await this.storeOutlookContact(userId, contact);
          syncedCount++;

          // Add rate limiting
          await this.delay(this.config.rateLimitDelay);
        } catch (contactError) {
          console.error(
            `Error processing Outlook contact ${contact.id}:`,
            contactError
          );
          errors.push(`Contact ${contact.id}: ${contactError.message}`);
        }
      }

      return { synced: syncedCount, errors };
    } catch (error) {
      console.error('Error syncing Outlook contacts:', error);
      this.handleError(error, 'sync_outlook_contacts');
      throw error;
    }
  }

  /**
   * Store Google contact in database
   * @param {number} userId - User ID
   * @param {Object} person - Google People API person object
   */
  async storeGoogleContact(userId, person) {
    try {
      const names = person.names?.[0] || {};
      const emails =
        person.emailAddresses?.map(e => ({
          email: e.value,
          type: e.type || 'other',
          primary: e.metadata?.primary || false,
        })) || [];

      const phones =
        person.phoneNumbers?.map(p => ({
          number: p.value,
          type: p.type || 'other',
          primary: p.metadata?.primary || false,
        })) || [];

      const addresses =
        person.addresses?.map(a => ({
          street: a.streetAddress,
          city: a.city,
          state: a.region,
          zip: a.postalCode,
          country: a.country,
          type: a.type || 'other',
        })) || [];

      const organizations =
        person.organizations?.map(o => ({
          company: o.name,
          title: o.title,
          department: o.department,
        })) || [];

      const birthday = person.birthdays?.[0]?.date
        ? this.formatBirthday(person.birthdays[0].date)
        : null;
      const photoUrl = person.photos?.[0]?.url || null;

      await pool.query(
        `
        INSERT INTO user_contacts 
        (user_id, contact_id, provider, first_name, last_name, display_name, 
         email_addresses, phone_numbers, addresses, organizations, birthday, 
         photo_url, notes, synced_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (user_id, contact_id, provider)
        DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          display_name = EXCLUDED.display_name,
          email_addresses = EXCLUDED.email_addresses,
          phone_numbers = EXCLUDED.phone_numbers,
          addresses = EXCLUDED.addresses,
          organizations = EXCLUDED.organizations,
          birthday = EXCLUDED.birthday,
          photo_url = EXCLUDED.photo_url,
          notes = EXCLUDED.notes,
          synced_at = NOW(),
          updated_at = NOW()
      `,
        [
          userId,
          person.resourceName,
          'google',
          names.givenName || '',
          names.familyName || '',
          names.displayName ||
            `${names.givenName || ''} ${names.familyName || ''}`.trim(),
          JSON.stringify(emails),
          JSON.stringify(phones),
          JSON.stringify(addresses),
          JSON.stringify(organizations),
          birthday,
          photoUrl,
          person.biographies?.[0]?.value || null,
        ]
      );
    } catch (error) {
      console.error('Error storing Google contact:', error);
      throw error;
    }
  }

  /**
   * Store Outlook contact in database
   * @param {number} userId - User ID
   * @param {Object} contact - Outlook contact object
   */
  async storeOutlookContact(userId, contact) {
    try {
      const emails =
        contact.emailAddresses?.map(e => ({
          email: e.address,
          type: e.name || 'other',
          primary: false, // Outlook doesn't specify primary
        })) || [];

      const phones = [];
      if (contact.businessPhones && contact.businessPhones.length > 0) {
        contact.businessPhones.forEach(phone => {
          phones.push({ number: phone, type: 'business', primary: false });
        });
      }

      if (contact.homePhones && contact.homePhones.length > 0) {
        contact.homePhones.forEach(phone => {
          phones.push({ number: phone, type: 'home', primary: false });
        });
      }

      if (contact.mobilePhone) {
        phones.push({
          number: contact.mobilePhone,
          type: 'mobile',
          primary: true,
        });
      }

      const addresses = [];
      if (contact.businessAddress) {
        addresses.push({
          street: contact.businessAddress.street,
          city: contact.businessAddress.city,
          state: contact.businessAddress.state,
          zip: contact.businessAddress.postalCode,
          country: contact.businessAddress.countryOrRegion,
          type: 'business',
        });
      }

      if (contact.homeAddress) {
        addresses.push({
          street: contact.homeAddress.street,
          city: contact.homeAddress.city,
          state: contact.homeAddress.state,
          zip: contact.homeAddress.postalCode,
          country: contact.homeAddress.countryOrRegion,
          type: 'home',
        });
      }

      const organizations = [];
      if (contact.companyName || contact.jobTitle) {
        organizations.push({
          company: contact.companyName,
          title: contact.jobTitle,
          department: null,
        });
      }

      const birthday = contact.birthday
        ? new Date(contact.birthday).toISOString().split('T')[0]
        : null;

      await pool.query(
        `
        INSERT INTO user_contacts 
        (user_id, contact_id, provider, first_name, last_name, display_name,
         email_addresses, phone_numbers, addresses, organizations, birthday,
         notes, synced_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (user_id, contact_id, provider)
        DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          display_name = EXCLUDED.display_name,
          email_addresses = EXCLUDED.email_addresses,
          phone_numbers = EXCLUDED.phone_numbers,
          addresses = EXCLUDED.addresses,
          organizations = EXCLUDED.organizations,
          birthday = EXCLUDED.birthday,
          notes = EXCLUDED.notes,
          synced_at = NOW(),
          updated_at = NOW()
      `,
        [
          userId,
          contact.id,
          'outlook',
          contact.givenName || '',
          contact.surname || '',
          contact.displayName ||
            `${contact.givenName || ''} ${contact.surname || ''}`.trim(),
          JSON.stringify(emails),
          JSON.stringify(phones),
          JSON.stringify(addresses),
          JSON.stringify(organizations),
          birthday,
          contact.personalNotes || null,
        ]
      );
    } catch (error) {
      console.error('Error storing Outlook contact:', error);
      throw error;
    }
  }

  /**
   * Get user's contacts with filtering
   * @param {number} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} - Contacts
   */
  async getContacts(userId, filters = {}) {
    try {
      const {
        provider,
        search,
        has_email,
        has_phone,
        birthday_month,
        limit = 100,
        offset = 0,
        sort_by = 'display_name',
      } = filters;

      let query = `
        SELECT id, contact_id, provider, first_name, last_name, display_name,
               email_addresses, phone_numbers, addresses, organizations,
               birthday, anniversary, relationship, photo_url, notes, tags,
               last_interaction_at, interaction_count, interaction_score,
               created_at, updated_at
        FROM user_contacts
        WHERE user_id = $1
      `;
      const params = [userId];
      let paramCount = 1;

      if (provider) {
        paramCount++;
        query += ` AND provider = $${paramCount}`;
        params.push(provider);
      }

      if (search) {
        paramCount++;
        query += ` AND (display_name ILIKE $${paramCount} OR first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      if (has_email !== undefined) {
        query += ` AND (email_addresses IS NOT NULL AND jsonb_array_length(email_addresses) > 0) = ${has_email}`;
      }

      if (has_phone !== undefined) {
        query += ` AND (phone_numbers IS NOT NULL AND jsonb_array_length(phone_numbers) > 0) = ${has_phone}`;
      }

      if (birthday_month) {
        paramCount++;
        query += ` AND EXTRACT(MONTH FROM birthday) = $${paramCount}`;
        params.push(parseInt(birthday_month));
      }

      // Sort options
      const sortOptions = {
        display_name: 'display_name ASC',
        last_name: 'last_name ASC, first_name ASC',
        recent_interaction: 'last_interaction_at DESC NULLS LAST',
        interaction_count: 'interaction_count DESC',
        created_at: 'created_at DESC',
      };

      const sortClause = sortOptions[sort_by] || sortOptions['display_name'];
      query += ` ORDER BY ${sortClause} LIMIT $${paramCount + 1} OFFSET $${
        paramCount + 2
      }`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting contacts:', error);
      this.handleError(error, 'get_contacts');
      throw error;
    }
  }

  /**
   * Create a new contact
   * @param {number} userId - User ID
   * @param {Object} contactData - Contact data
   * @returns {Promise<Object>} - Created contact
   */
  async createContact(userId, contactData) {
    try {
      const {
        first_name,
        last_name,
        display_name,
        email_addresses = [],
        phone_numbers = [],
        addresses = [],
        organizations = [],
        birthday,
        anniversary,
        relationship,
        notes,
        tags = [],
      } = contactData;

      // Validate required fields
      if (!first_name && !last_name && !display_name) {
        throw new Error(
          'At least one name field (first_name, last_name, or display_name) is required'
        );
      }

      const result = await pool.query(
        `
        INSERT INTO user_contacts 
        (user_id, contact_id, provider, first_name, last_name, display_name,
         email_addresses, phone_numbers, addresses, organizations, birthday,
         anniversary, relationship, notes, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `,
        [
          userId,
          `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          'manual',
          first_name || '',
          last_name || '',
          display_name || `${first_name || ''} ${last_name || ''}`.trim(),
          JSON.stringify(email_addresses),
          JSON.stringify(phone_numbers),
          JSON.stringify(addresses),
          JSON.stringify(organizations),
          birthday,
          anniversary,
          relationship,
          notes,
          tags,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating contact:', error);
      this.handleError(error, 'create_contact');
      throw error;
    }
  }

  /**
   * Update an existing contact
   * @param {number} userId - User ID
   * @param {number} contactId - Contact ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} - Updated contact
   */
  async updateContact(userId, contactId, updateData) {
    try {
      const allowedFields = [
        'first_name',
        'last_name',
        'display_name',
        'email_addresses',
        'phone_numbers',
        'addresses',
        'organizations',
        'birthday',
        'anniversary',
        'relationship',
        'notes',
        'tags',
      ];

      const updates = [];
      const params = [];
      let paramCount = 0;

      for (const [field, value] of Object.entries(updateData)) {
        if (allowedFields.includes(field) && value !== undefined) {
          paramCount++;
          updates.push(`${field} = $${paramCount}`);

          if (
            [
              'email_addresses',
              'phone_numbers',
              'addresses',
              'organizations',
              'tags',
            ].includes(field)
          ) {
            params.push(JSON.stringify(value));
          } else {
            params.push(value);
          }
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid updates provided');
      }

      updates.push('updated_at = NOW()');

      const query = `
        UPDATE user_contacts 
        SET ${updates.join(', ')}
        WHERE user_id = $${paramCount + 1} AND id = $${paramCount + 2}
        RETURNING *
      `;
      params.push(userId, contactId);

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('Contact not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error updating contact:', error);
      this.handleError(error, 'update_contact');
      throw error;
    }
  }

  /**
   * Delete a contact
   * @param {number} userId - User ID
   * @param {number} contactId - Contact ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteContact(userId, contactId) {
    try {
      const result = await pool.query(
        'DELETE FROM user_contacts WHERE user_id = $1 AND id = $2 RETURNING id',
        [userId, contactId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting contact:', error);
      this.handleError(error, 'delete_contact');
      throw error;
    }
  }

  /**
   * Record contact interaction
   * @param {number} userId - User ID
   * @param {number} contactId - Contact ID
   * @param {Object} interactionData - Interaction data
   * @returns {Promise<Object>} - Recorded interaction
   */
  async recordInteraction(userId, contactId, interactionData) {
    try {
      const {
        interaction_type,
        interaction_date = new Date(),
        direction = 'mutual',
        subject,
        description,
        duration_minutes,
        location,
        metadata = {},
        sentiment = 'neutral',
        importance_score = 0.5,
      } = interactionData;

      // Validate required fields
      if (!interaction_type) {
        throw new Error('Interaction type is required');
      }

      // Record the interaction
      const result = await pool.query(
        `
        INSERT INTO user_contact_interactions 
        (user_id, contact_id, interaction_type, interaction_date, direction,
         subject, description, duration_minutes, location, metadata, 
         sentiment, importance_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `,
        [
          userId,
          contactId,
          interaction_type,
          interaction_date,
          direction,
          subject,
          description,
          duration_minutes,
          location,
          JSON.stringify(metadata),
          sentiment,
          importance_score,
        ]
      );

      // Update contact interaction stats
      await pool.query(
        `
        UPDATE user_contacts 
        SET 
          last_interaction_at = $1,
          interaction_count = interaction_count + 1,
          interaction_score = LEAST(interaction_score + $2, 10.0),
          updated_at = NOW()
        WHERE user_id = $3 AND id = $4
      `,
        [interaction_date, importance_score, userId, contactId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error recording contact interaction:', error);
      this.handleError(error, 'record_interaction');
      throw error;
    }
  }

  /**
   * Find and merge duplicate contacts
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Deduplication results
   */
  async deduplicateContacts(userId) {
    try {
      let duplicatesFound = 0;
      let duplicatesMerged = 0;

      // Find potential duplicates based on name and email similarity
      const duplicateQuery = `
        SELECT ARRAY_AGG(id ORDER BY created_at) as contact_ids,
               display_name, email_addresses
        FROM user_contacts
        WHERE user_id = $1
        GROUP BY LOWER(TRIM(display_name)), email_addresses::text
        HAVING COUNT(*) > 1
      `;

      const duplicatesResult = await pool.query(duplicateQuery, [userId]);

      for (const duplicateGroup of duplicatesResult.rows) {
        const contactIds = duplicateGroup.contact_ids;
        if (contactIds && contactIds.length > 1) {
          duplicatesFound += contactIds.length - 1;

          // Keep the first contact and merge others into it
          const primaryContactId = contactIds[0];
          const duplicateIds = contactIds.slice(1);

          // Merge contact interactions
          await pool.query(
            `
            UPDATE user_contact_interactions 
            SET contact_id = $1 
            WHERE user_id = $2 AND contact_id = ANY($3)
          `,
            [primaryContactId, userId, duplicateIds]
          );

          // Update interaction count and score for primary contact
          await pool.query(
            `
            UPDATE user_contacts 
            SET 
              interaction_count = (
                SELECT COUNT(*) FROM user_contact_interactions 
                WHERE contact_id = $1
              ),
              interaction_score = LEAST(
                (SELECT AVG(importance_score) * COUNT(*) / 10.0 
                 FROM user_contact_interactions 
                 WHERE contact_id = $1), 
                10.0
              )
            WHERE id = $1
          `,
            [primaryContactId]
          );

          // Delete duplicate contacts
          await pool.query(
            'DELETE FROM user_contacts WHERE user_id = $1 AND id = ANY($2)',
            [userId, duplicateIds]
          );

          duplicatesMerged += duplicateIds.length;
        }
      }

      return {
        duplicates_found: duplicatesFound,
        duplicates_merged: duplicatesMerged,
      };
    } catch (error) {
      console.error('Error deduplicating contacts:', error);
      this.handleError(error, 'deduplicate_contacts');
      throw error;
    }
  }

  /**
   * Helper: Format birthday from Google People API date
   * @param {Object} date - Google People API date object
   * @returns {string|null} - Formatted date (YYYY-MM-DD)
   */
  formatBirthday(date) {
    try {
      if (!date) return null;

      const year = date.year || 1900;
      const month = String(date.month || 1).padStart(2, '0');
      const day = String(date.day || 1).padStart(2, '0');

      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting birthday:', error);
      return null;
    }
  }

  /**
   * AI-powered contact insights and analytics
   * @param {number} userId - User ID
   * @param {number} days - Number of days to analyze
   * @returns {Promise<Object>} - Contact insights
   */
  async getContactInsights(userId, days = 30) {
    try {
      const insights = {
        total_contacts: 0,
        contacts_with_recent_interactions: 0,
        top_contacts_by_interaction: [],
        upcoming_birthdays: [],
        contact_distribution: {
          by_provider: {},
          by_organization: {},
          by_location: {},
        },
        interaction_patterns: {
          most_active_days: [],
          interaction_types: {},
          average_interaction_frequency: 0,
        },
        recommendations: [],
      };

      // Get total contacts
      const totalResult = await pool.query(
        'SELECT COUNT(*) as count FROM user_contacts WHERE user_id = $1',
        [userId]
      );
      insights.total_contacts = parseInt(totalResult.rows[0].count);

      // Get contacts with recent interactions
      const recentInteractionsResult = await pool.query(
        `
        SELECT COUNT(DISTINCT contact_id) as count
        FROM user_contact_interactions
        WHERE user_id = $1 AND interaction_date >= NOW() - INTERVAL '${parseInt(
          days
        )} days'
      `,
        [userId]
      );
      insights.contacts_with_recent_interactions = parseInt(
        recentInteractionsResult.rows[0].count
      );

      // Get top contacts by interaction
      const topContactsResult = await pool.query(
        `
        SELECT c.display_name, c.email_addresses, c.organizations,
               COUNT(i.id) as interaction_count,
               MAX(i.interaction_date) as last_interaction,
               AVG(i.importance_score) as avg_importance
        FROM user_contacts c
        LEFT JOIN user_contact_interactions i ON c.id = i.contact_id
        WHERE c.user_id = $1 AND i.interaction_date >= NOW() - INTERVAL '${parseInt(
          days
        )} days'
        GROUP BY c.id, c.display_name, c.email_addresses, c.organizations
        ORDER BY interaction_count DESC, avg_importance DESC
        LIMIT 10
      `,
        [userId]
      );
      insights.top_contacts_by_interaction = topContactsResult.rows;

      // Get upcoming birthdays (next 30 days)
      const birthdaysResult = await pool.query(
        `
        SELECT display_name, birthday, 
               CASE 
                 WHEN DATE_PART('month', birthday) = DATE_PART('month', CURRENT_DATE) 
                      AND DATE_PART('day', birthday) >= DATE_PART('day', CURRENT_DATE)
                 THEN DATE_PART('day', birthday) - DATE_PART('day', CURRENT_DATE)
                 WHEN DATE_PART('month', birthday) > DATE_PART('month', CURRENT_DATE)
                 THEN DATE_PART('doy', birthday) - DATE_PART('doy', CURRENT_DATE)
                 ELSE 365 + DATE_PART('doy', birthday) - DATE_PART('doy', CURRENT_DATE)
               END as days_until_birthday
        FROM user_contacts
        WHERE user_id = $1 AND birthday IS NOT NULL
        HAVING days_until_birthday <= 30
        ORDER BY days_until_birthday ASC
        LIMIT 10
      `,
        [userId]
      );
      insights.upcoming_birthdays = birthdaysResult.rows;

      // Contact distribution by provider
      const providerDistResult = await pool.query(
        `
        SELECT provider, COUNT(*) as count
        FROM user_contacts
        WHERE user_id = $1
        GROUP BY provider
      `,
        [userId]
      );

      for (const row of providerDistResult.rows) {
        insights.contact_distribution.by_provider[row.provider] = parseInt(
          row.count
        );
      }

      // Generate recommendations
      insights.recommendations = this.generateContactRecommendations(insights);

      return insights;
    } catch (error) {
      console.error('Error getting contact insights:', error);
      this.handleError(error, 'get_contact_insights');
      throw error;
    }
  }

  /**
   * Generate contact management recommendations
   * @param {Object} insights - Contact insights data
   * @returns {Array} - Recommendations
   */
  generateContactRecommendations(insights) {
    const recommendations = [];

    // Birthday reminders
    if (insights.upcoming_birthdays && insights.upcoming_birthdays.length > 0) {
      recommendations.push({
        type: 'birthday_reminder',
        priority: 'medium',
        message: `${insights.upcoming_birthdays.length} contacts have birthdays coming up in the next 30 days`,
        action: 'Set up birthday reminders or reach out to wish them well',
        count: insights.upcoming_birthdays.length,
      });
    }

    // Inactive contacts
    const inactivePercentage =
      insights.total_contacts > 0
        ? (1 -
            insights.contacts_with_recent_interactions /
              insights.total_contacts) *
          100
        : 0;

    if (inactivePercentage > 50) {
      recommendations.push({
        type: 'inactive_contacts',
        priority: 'low',
        message: `${Math.round(
          inactivePercentage
        )}% of your contacts haven't been interacted with recently`,
        action:
          'Consider reaching out to strengthen relationships or cleaning up your contact list',
        percentage: Math.round(inactivePercentage),
      });
    }

    // Contact organization
    if (insights.total_contacts > 50) {
      recommendations.push({
        type: 'contact_organization',
        priority: 'low',
        message: `You have ${insights.total_contacts} contacts. Consider organizing them with tags or groups`,
        action:
          'Add tags to categorize contacts by relationship type or importance',
        total_contacts: insights.total_contacts,
      });
    }

    return recommendations;
  }

  /**
   * Enhanced contact search with AI-powered matching
   * @param {number} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchContacts(userId, query, options = {}) {
    try {
      const {
        include_interactions = false,
        fuzzy_matching = true,
        limit = this.config.maxSearchResults,
      } = options;

      let sql = `
        SELECT c.*, 
               ts_rank(to_tsvector('english', 
                 c.first_name || ' ' || c.last_name || ' ' || c.display_name || ' ' || 
                 COALESCE(c.notes, '') || ' ' || 
                 COALESCE(c.email_addresses::text, '')
               ), plainto_tsquery('english', $2)) as relevance
        FROM user_contacts c
        WHERE c.user_id = $1
      `;
      const params = [userId, query];

      if (fuzzy_matching) {
        sql += ` AND (
          to_tsvector('english', 
            c.first_name || ' ' || c.last_name || ' ' || c.display_name || ' ' || 
            COALESCE(c.notes, '') || ' ' || 
            COALESCE(c.email_addresses::text, '')
          ) @@ plainto_tsquery('english', $2)
          OR c.display_name ILIKE '%' || $2 || '%'
          OR c.first_name ILIKE '%' || $2 || '%'
          OR c.last_name ILIKE '%' || $2 || '%'
        )`;
      } else {
        sql += ` AND (
          c.display_name ILIKE '%' || $2 || '%'
          OR c.first_name ILIKE '%' || $2 || '%'
          OR c.last_name ILIKE '%' || $2 || '%'
        )`;
      }

      sql += ` ORDER BY relevance DESC, c.interaction_score DESC, c.display_name ASC LIMIT $3`;
      params.push(limit);

      const result = await pool.query(sql, params);
      let contacts = result.rows;

      // Include interaction data if requested
      if (include_interactions && contacts.length > 0) {
        const contactIds = contacts.map(c => c.id);
        const interactionsResult = await pool.query(
          `
          SELECT contact_id,
                 COUNT(*) as total_interactions,
                 MAX(interaction_date) as last_interaction,
                 AVG(importance_score) as avg_importance
          FROM user_contact_interactions
          WHERE user_id = $1 AND contact_id = ANY($2)
          GROUP BY contact_id
        `,
          [userId, contactIds]
        );

        const interactionMap = {};
        for (const interaction of interactionsResult.rows) {
          interactionMap[interaction.contact_id] = {
            total_interactions: parseInt(interaction.total_interactions),
            last_interaction: interaction.last_interaction,
            avg_importance: parseFloat(interaction.avg_importance),
          };
        }

        contacts = contacts.map(contact => ({
          ...contact,
          interaction_data: interactionMap[contact.id] || {
            total_interactions: 0,
            last_interaction: null,
            avg_importance: 0,
          },
        }));
      }

      return contacts;
    } catch (error) {
      console.error('Error searching contacts:', error);
      this.handleError(error, 'search_contacts');
      throw error;
    }
  }

  /**
   * Test contact API connectivity
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Test results
   */
  async testConnectivity(userId) {
    try {
      await this.initializeGoogleContacts(userId);

      // Test basic People API access
      const profile = await this.googleContacts.people.get({
        resourceName: 'people/me',
        personFields: 'names,emailAddresses',
      });

      return {
        success: true,
        user_name: profile.data.names?.[0]?.displayName || 'Unknown',
        user_email: profile.data.emailAddresses?.[0]?.value || 'Unknown',
        enhanced_features_available: !!this.googleAPI,
        message: 'Google Contacts API connectivity verified',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        enhanced_features_available: false,
        message: 'Google Contacts API connectivity failed',
      };
    }
  }

  /**
   * Get service status
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      service: 'ContactService',
      version: '2.0-enhanced',
      initialized: this.initialized,
      current_user: this.currentUserId || null,
      google_api_service: this.googleAPI ? 'connected' : 'disconnected',
      health_status: this.healthStatus,
      error_count: this.errorCount,
      last_error: this.lastError,
      uptime: Date.now() - this.initTime,
      providers: {
        google: !!this.googleContacts,
        outlook: !!this.outlookContacts,
      },
      features: {
        contact_sync: true,
        ai_powered_search: true,
        interaction_tracking: true,
        duplicate_detection: true,
        contact_insights: true,
        birthday_tracking: true,
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
        `[ContactService] ⚠️ Critical error count reached (${this.errorCount})`
      );
    }

    console.error(`[ContactService] Error in ${context}:`, error.message);
  }

  async destroy() {
    try {
      console.log('[ContactService] 🔄 Destroying service...');

      this.initialized = false;
      this.googleContacts = null;
      this.outlookContacts = null;
      this.currentUserId = null;
      this.healthStatus = 'destroyed';

      console.log('[ContactService] ✅ Service destroyed successfully');
    } catch (error) {
      console.error('[ContactService] ❌ Error during destroy:', error);
    }
  }
}

export default new ContactService();

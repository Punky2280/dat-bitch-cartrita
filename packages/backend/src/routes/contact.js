const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const ContactService = require('../services/ContactService');
const pool = require('../db');

const router = express.Router();

// Sync user's contacts from configured providers
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { providers = ['google'], max_contacts = 1000 } = req.body;
    
    console.log(`[Contact] Starting sync for user ${userId} with providers:`, providers);
    
    const syncResults = await ContactService.syncContacts(userId, {
      providers,
      maxContacts: max_contacts
    });
    
    res.json({
      success: true,
      message: 'Contact sync completed',
      results: syncResults
    });
  } catch (error) {
    console.error('Contact sync error:', error);
    
    if (error.message.includes('credentials not found')) {
      return res.status(400).json({
        success: false,
        error: 'Contact provider not connected',
        code: 'CREDENTIALS_MISSING',
        message: 'Please connect your contact provider account in Settings > Integrations'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user's contacts with filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      provider,
      search,
      has_email,
      has_phone,
      birthday_month,
      limit = 100,
      offset = 0,
      sort_by = 'display_name'
    } = req.query;

    const filters = {
      provider,
      search,
      has_email: has_email !== undefined ? has_email === 'true' : undefined,
      has_phone: has_phone !== undefined ? has_phone === 'true' : undefined,
      birthday_month,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort_by
    };

    const contacts = await ContactService.getContacts(userId, filters);

    res.json({
      success: true,
      contacts: contacts,
      count: contacts.length,
      filters: filters
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create a new contact
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const contactData = req.body;

    // Validate required fields
    if (!contactData.first_name && !contactData.last_name && !contactData.display_name) {
      return res.status(400).json({
        success: false,
        error: 'At least one name field (first_name, last_name, or display_name) is required'
      });
    }

    // Validate email addresses if provided
    if (contactData.email_addresses && Array.isArray(contactData.email_addresses)) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const emailObj of contactData.email_addresses) {
        if (emailObj.email && !emailRegex.test(emailObj.email)) {
          return res.status(400).json({
            success: false,
            error: `Invalid email address: ${emailObj.email}`
          });
        }
      }
    }

    const newContact = await ContactService.createContact(userId, contactData);

    res.status(201).json({
      success: true,
      message: 'Contact created successfully',
      contact: newContact
    });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update an existing contact
router.put('/:contactId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contactId } = req.params;
    const updateData = req.body;

    // Validate email addresses if provided
    if (updateData.email_addresses && Array.isArray(updateData.email_addresses)) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const emailObj of updateData.email_addresses) {
        if (emailObj.email && !emailRegex.test(emailObj.email)) {
          return res.status(400).json({
            success: false,
            error: `Invalid email address: ${emailObj.email}`
          });
        }
      }
    }

    const updatedContact = await ContactService.updateContact(userId, parseInt(contactId), updateData);

    res.json({
      success: true,
      message: 'Contact updated successfully',
      contact: updatedContact
    });
  } catch (error) {
    console.error('Error updating contact:', error);
    
    if (error.message === 'Contact not found') {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a contact
router.delete('/:contactId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contactId } = req.params;

    const deleted = await ContactService.deleteContact(userId, parseInt(contactId));

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Record a contact interaction
router.post('/:contactId/interactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contactId } = req.params;
    const interactionData = req.body;

    // Validate required fields
    if (!interactionData.interaction_type) {
      return res.status(400).json({
        success: false,
        error: 'Interaction type is required'
      });
    }

    const interaction = await ContactService.recordInteraction(
      userId, 
      parseInt(contactId), 
      interactionData
    );

    res.status(201).json({
      success: true,
      message: 'Interaction recorded successfully',
      interaction: interaction
    });
  } catch (error) {
    console.error('Error recording interaction:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get contact interactions
router.get('/:contactId/interactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contactId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT interaction_type, interaction_date, direction, subject, description,
             duration_minutes, location, metadata, sentiment, importance_score,
             created_at
      FROM user_contact_interactions
      WHERE user_id = $1 AND contact_id = $2
      ORDER BY interaction_date DESC
      LIMIT $3 OFFSET $4
    `, [userId, parseInt(contactId), parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      interactions: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching contact interactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get contact statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30, provider } = req.query;

    let providerFilter = '';
    const params = [userId, parseInt(days)];

    if (provider) {
      providerFilter = 'AND provider = $3';
      params.push(provider);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_contacts,
        COUNT(CASE WHEN email_addresses IS NOT NULL AND jsonb_array_length(email_addresses) > 0 THEN 1 END) as contacts_with_email,
        COUNT(CASE WHEN phone_numbers IS NOT NULL AND jsonb_array_length(phone_numbers) > 0 THEN 1 END) as contacts_with_phone,
        COUNT(CASE WHEN birthday IS NOT NULL THEN 1 END) as contacts_with_birthday,
        COUNT(CASE WHEN last_interaction_at >= NOW() - INTERVAL '${parseInt(days)} days' THEN 1 END) as recent_interactions,
        AVG(interaction_score) as avg_interaction_score
      FROM user_contacts
      WHERE user_id = $1
        ${providerFilter}
    `;

    const statsResult = await pool.query(statsQuery, params);
    const stats = statsResult.rows[0];

    // Get provider breakdown
    const providerBreakdownQuery = `
      SELECT 
        provider,
        COUNT(*) as contact_count
      FROM user_contacts
      WHERE user_id = $1
      GROUP BY provider
      ORDER BY contact_count DESC
    `;

    const providerBreakdownResult = await pool.query(providerBreakdownQuery, [userId]);

    // Get upcoming birthdays (next 30 days)
    const upcomingBirthdaysQuery = `
      SELECT id, display_name, birthday,
             EXTRACT(DOY FROM birthday) - EXTRACT(DOY FROM NOW()) as days_until_birthday
      FROM user_contacts
      WHERE user_id = $1 AND birthday IS NOT NULL
        AND (
          (EXTRACT(DOY FROM birthday) >= EXTRACT(DOY FROM NOW()) AND 
           EXTRACT(DOY FROM birthday) <= EXTRACT(DOY FROM NOW()) + 30)
          OR
          (EXTRACT(DOY FROM NOW()) + 30 > 365 AND 
           EXTRACT(DOY FROM birthday) <= (EXTRACT(DOY FROM NOW()) + 30) - 365)
        )
      ORDER BY 
        CASE 
          WHEN EXTRACT(DOY FROM birthday) >= EXTRACT(DOY FROM NOW()) 
          THEN EXTRACT(DOY FROM birthday) - EXTRACT(DOY FROM NOW())
          ELSE (365 - EXTRACT(DOY FROM NOW())) + EXTRACT(DOY FROM birthday)
        END
      LIMIT 10
    `;

    const upcomingBirthdaysResult = await pool.query(upcomingBirthdaysQuery, [userId]);

    res.json({
      success: true,
      stats: {
        ...stats,
        total_contacts: parseInt(stats.total_contacts),
        contacts_with_email: parseInt(stats.contacts_with_email),
        contacts_with_phone: parseInt(stats.contacts_with_phone),
        contacts_with_birthday: parseInt(stats.contacts_with_birthday),
        recent_interactions: parseInt(stats.recent_interactions),
        avg_interaction_score: parseFloat(stats.avg_interaction_score) || 0,
        provider_breakdown: providerBreakdownResult.rows,
        upcoming_birthdays: upcomingBirthdaysResult.rows
      },
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching contact statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search contacts with advanced filtering
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      query: searchQuery,
      provider,
      has_email,
      has_phone,
      birthday_month,
      interaction_score_min,
      tags,
      limit = 25,
      offset = 0
    } = req.query;

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    let sql = `
      SELECT id, contact_id, provider, first_name, last_name, display_name,
             email_addresses, phone_numbers, birthday, tags, last_interaction_at,
             interaction_count, interaction_score, photo_url
      FROM user_contacts
      WHERE user_id = $1
        AND (display_name ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2)
    `;
    
    const params = [userId, `%${searchQuery}%`];
    let paramCount = 2;

    if (provider) {
      paramCount++;
      sql += ` AND provider = $${paramCount}`;
      params.push(provider);
    }

    if (has_email !== undefined) {
      sql += ` AND (email_addresses IS NOT NULL AND jsonb_array_length(email_addresses) > 0) = ${has_email === 'true'}`;
    }

    if (has_phone !== undefined) {
      sql += ` AND (phone_numbers IS NOT NULL AND jsonb_array_length(phone_numbers) > 0) = ${has_phone === 'true'}`;
    }

    if (birthday_month) {
      paramCount++;
      sql += ` AND EXTRACT(MONTH FROM birthday) = $${paramCount}`;
      params.push(parseInt(birthday_month));
    }

    if (interaction_score_min) {
      paramCount++;
      sql += ` AND interaction_score >= $${paramCount}`;
      params.push(parseFloat(interaction_score_min));
    }

    if (tags) {
      paramCount++;
      sql += ` AND tags @> $${paramCount}`;
      params.push(JSON.stringify([tags]));
    }

    sql += ` ORDER BY interaction_score DESC, display_name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      contacts: result.rows,
      count: result.rows.length,
      query: searchQuery,
      filters: { provider, has_email, has_phone, birthday_month, interaction_score_min, tags }
    });
  } catch (error) {
    console.error('Error searching contacts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Deduplicate contacts
router.post('/deduplicate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[Contact] Starting deduplication for user ${userId}`);
    
    const deduplicationResults = await ContactService.deduplicateContacts(userId);
    
    res.json({
      success: true,
      message: 'Contact deduplication completed',
      results: deduplicationResults
    });
  } catch (error) {
    console.error('Contact deduplication error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Contact service status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = ContactService.getStatus();
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Error getting contact service status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
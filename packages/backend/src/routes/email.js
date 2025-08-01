const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const EmailService = require('../services/EmailService');
const pool = require('../db');

const router = express.Router();

// Sync user's emails from configured providers
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { providers = ['gmail'], max_messages = 100 } = req.body;
    
    console.log(`[Email] Starting sync for user ${userId} with providers:`, providers);
    
    const syncResults = await EmailService.syncEmails(userId, {
      providers,
      maxMessages: max_messages
    });
    
    res.json({
      success: true,
      message: 'Email sync completed',
      results: syncResults
    });
  } catch (error) {
    console.error('Email sync error:', error);
    
    if (error.message.includes('credentials not found')) {
      return res.status(400).json({
        success: false,
        error: 'Email provider not connected',
        code: 'CREDENTIALS_MISSING',
        message: 'Please connect your email account in Settings > Integrations'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user's email messages with filtering
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      provider,
      folder = 'inbox',
      is_read,
      limit = 50,
      offset = 0,
      search,
      start_date,
      end_date
    } = req.query;

    const filters = {
      provider,
      folder,
      is_read: is_read !== undefined ? is_read === 'true' : undefined,
      limit: parseInt(limit),
      offset: parseInt(offset),
      search,
      start_date,
      end_date
    };

    const messages = await EmailService.getMessages(userId, filters);

    res.json({
      success: true,
      messages: messages,
      count: messages.length,
      filters: filters
    });
  } catch (error) {
    console.error('Error fetching email messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send a new email
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const emailData = req.body;
    const { provider = 'gmail' } = req.body;

    // Validate required fields
    if (!emailData.to || !emailData.subject) {
      return res.status(400).json({
        success: false,
        error: 'Recipient (to) and subject are required'
      });
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
    
    for (const email of recipients) {
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: `Invalid email address: ${email}`
        });
      }
    }

    const sentMessage = await EmailService.sendEmail(userId, emailData, provider);

    res.json({
      success: true,
      message: 'Email sent successfully',
      sent_message: sentMessage
    });
  } catch (error) {
    console.error('Error sending email:', error);
    
    if (error.message.includes('credentials not found')) {
      return res.status(400).json({
        success: false,
        error: 'Email provider not connected',
        code: 'CREDENTIALS_MISSING'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update email message (mark as read/unread, add labels, etc.)
router.put('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { is_read, is_important, labels } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 0;

    if (is_read !== undefined) {
      paramCount++;
      updates.push(`is_read = $${paramCount}`);
      params.push(is_read);
    }

    if (is_important !== undefined) {
      paramCount++;
      updates.push(`is_important = $${paramCount}`);
      params.push(is_important);
    }

    if (labels !== undefined) {
      paramCount++;
      updates.push(`labels = $${paramCount}`);
      params.push(labels);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid updates provided'
      });
    }

    updates.push('updated_at = NOW()');
    
    const query = `
      UPDATE user_email_messages 
      SET ${updates.join(', ')}
      WHERE user_id = $${paramCount + 1} AND message_id = $${paramCount + 2}
      RETURNING message_id, is_read, is_important, labels
    `;
    params.push(userId, messageId);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      message: 'Message updated successfully',
      updated_message: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating email message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate AI summaries for email messages
router.post('/summarize', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message_ids = [], auto_categorize = true } = req.body;

    if (message_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one message ID is required'
      });
    }

    if (message_ids.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 messages can be summarized at once'
      });
    }

    const summaryResults = await EmailService.generateEmailSummaries(userId, message_ids);

    res.json({
      success: true,
      message: 'Email summaries generated successfully',
      results: summaryResults
    });
  } catch (error) {
    console.error('Error generating email summaries:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get email statistics and analytics
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
        COUNT(*) as total_messages,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_messages,
        COUNT(CASE WHEN is_important = true THEN 1 END) as important_messages,
        COUNT(DISTINCT sender_email) as unique_senders,
        AVG(CASE WHEN ai_sentiment = 'positive' THEN 1 WHEN ai_sentiment = 'negative' THEN -1 ELSE 0 END) as avg_sentiment,
        COUNT(CASE WHEN ai_category = 'work' THEN 1 END) as work_emails,
        COUNT(CASE WHEN ai_category = 'personal' THEN 1 END) as personal_emails,
        COUNT(CASE WHEN ai_category = 'finance' THEN 1 END) as finance_emails
      FROM user_email_messages
      WHERE user_id = $1 
        AND received_at >= NOW() - INTERVAL '${parseInt(days)} days'
        ${providerFilter}
    `;

    const statsResult = await pool.query(statsQuery, params);
    const stats = statsResult.rows[0];

    // Get top senders
    const topSendersQuery = `
      SELECT 
        sender_email,
        sender_name,
        COUNT(*) as message_count,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count
      FROM user_email_messages
      WHERE user_id = $1 
        AND received_at >= NOW() - INTERVAL '${parseInt(days)} days'
        ${providerFilter}
        AND sender_email IS NOT NULL
      GROUP BY sender_email, sender_name
      ORDER BY message_count DESC
      LIMIT 10
    `;

    const topSendersResult = await pool.query(topSendersQuery, params);

    // Get daily email volume
    const dailyVolumeQuery = `
      SELECT 
        DATE(received_at) as date,
        COUNT(*) as message_count,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count
      FROM user_email_messages
      WHERE user_id = $1 
        AND received_at >= NOW() - INTERVAL '${parseInt(days)} days'
        ${providerFilter}
      GROUP BY DATE(received_at)
      ORDER BY date DESC
      LIMIT 7
    `;

    const dailyVolumeResult = await pool.query(dailyVolumeQuery, params);

    res.json({
      success: true,
      stats: {
        ...stats,
        total_messages: parseInt(stats.total_messages),
        unread_messages: parseInt(stats.unread_messages),
        important_messages: parseInt(stats.important_messages),
        unique_senders: parseInt(stats.unique_senders),
        avg_sentiment: parseFloat(stats.avg_sentiment) || 0,
        work_emails: parseInt(stats.work_emails),
        personal_emails: parseInt(stats.personal_emails),
        finance_emails: parseInt(stats.finance_emails),
        top_senders: topSendersResult.rows,
        daily_volume: dailyVolumeResult.rows
      },
      period_days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching email statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get email sync status
router.get('/sync-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT provider, email_address, last_sync_at, sync_enabled, 
             folders_to_sync, auto_categorize, auto_summarize
      FROM user_email_sync
      WHERE user_id = $1
      ORDER BY provider
    `, [userId]);

    res.json({
      success: true,
      sync_status: result.rows
    });
  } catch (error) {
    console.error('Error fetching email sync status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update email sync settings
router.put('/sync-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      provider, 
      sync_enabled,
      folders_to_sync,
      auto_categorize,
      auto_summarize,
      sync_interval_minutes
    } = req.body;

    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider is required'
      });
    }

    const updates = [];
    const params = [];
    let paramCount = 0;

    if (sync_enabled !== undefined) {
      paramCount++;
      updates.push(`sync_enabled = $${paramCount}`);
      params.push(sync_enabled);
    }

    if (folders_to_sync !== undefined) {
      paramCount++;
      updates.push(`folders_to_sync = $${paramCount}`);
      params.push(folders_to_sync);
    }

    if (auto_categorize !== undefined) {
      paramCount++;
      updates.push(`auto_categorize = $${paramCount}`);
      params.push(auto_categorize);
    }

    if (auto_summarize !== undefined) {
      paramCount++;
      updates.push(`auto_summarize = $${paramCount}`);
      params.push(auto_summarize);
    }

    if (sync_interval_minutes !== undefined) {
      paramCount++;
      updates.push(`sync_interval_minutes = $${paramCount}`);
      params.push(sync_interval_minutes);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid updates provided'
      });
    }

    updates.push('updated_at = NOW()');
    
    const query = `
      UPDATE user_email_sync 
      SET ${updates.join(', ')}
      WHERE user_id = $${paramCount + 1} AND provider = $${paramCount + 2}
      RETURNING provider, sync_enabled, folders_to_sync, auto_categorize, auto_summarize
    `;
    params.push(userId, provider);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email sync configuration not found'
      });
    }

    res.json({
      success: true,
      message: 'Email sync settings updated successfully',
      settings: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating email sync settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search emails with advanced filtering
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      query: searchQuery,
      provider,
      sender,
      has_attachments,
      is_important,
      category,
      sentiment,
      date_from,
      date_to,
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
      SELECT message_id, provider, subject, sender_email, sender_name,
             body_text, is_read, is_important, received_at,
             ai_summary, ai_category, ai_sentiment,
             ts_rank(to_tsvector('english', subject || ' ' || COALESCE(body_text, '')), plainto_tsquery('english', $2)) as relevance
      FROM user_email_messages
      WHERE user_id = $1
        AND to_tsvector('english', subject || ' ' || COALESCE(body_text, '')) @@ plainto_tsquery('english', $2)
    `;
    
    const params = [userId, searchQuery];
    let paramCount = 2;

    if (provider) {
      paramCount++;
      sql += ` AND provider = $${paramCount}`;
      params.push(provider);
    }

    if (sender) {
      paramCount++;
      sql += ` AND sender_email ILIKE $${paramCount}`;
      params.push(`%${sender}%`);
    }

    if (has_attachments !== undefined) {
      paramCount++;
      sql += ` AND (attachments IS NOT NULL AND jsonb_array_length(attachments) > 0) = $${paramCount}`;
      params.push(has_attachments === 'true');
    }

    if (is_important !== undefined) {
      paramCount++;
      sql += ` AND is_important = $${paramCount}`;
      params.push(is_important === 'true');
    }

    if (category) {
      paramCount++;
      sql += ` AND ai_category = $${paramCount}`;
      params.push(category);
    }

    if (sentiment) {
      paramCount++;
      sql += ` AND ai_sentiment = $${paramCount}`;
      params.push(sentiment);
    }

    if (date_from) {
      paramCount++;
      sql += ` AND received_at >= $${paramCount}`;
      params.push(date_from);
    }

    if (date_to) {
      paramCount++;
      sql += ` AND received_at <= $${paramCount}`;
      params.push(date_to);
    }

    sql += ` ORDER BY relevance DESC, received_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(sql, params);

    res.json({
      success: true,
      messages: result.rows,
      count: result.rows.length,
      query: searchQuery,
      filters: { provider, sender, has_attachments, is_important, category, sentiment, date_from, date_to }
    });
  } catch (error) {
    console.error('Error searching emails:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enhanced email analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30, enhanced = 'true' } = req.query;
    
    if (enhanced === 'true') {
      const analytics = await EmailService.getEnhancedEmailAnalytics(userId, parseInt(days));
      
      res.json({
        success: true,
        analytics: analytics,
        enhanced_features: true,
        period_days: parseInt(days)
      });
    } else {
      // Fallback to basic stats
      const basicStats = await EmailService.getMessages(userId, { limit: 1000 });
      
      res.json({
        success: true,
        analytics: {
          total_messages: basicStats.length,
          enhanced_features: false
        },
        period_days: parseInt(days)
      });
    }
  } catch (error) {
    console.error('Error getting email analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test email connectivity
router.get('/test-connection', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const connectivityTest = await EmailService.testConnectivity(userId);
    
    res.json({
      success: true,
      connectivity_test: connectivityTest
    });
  } catch (error) {
    console.error('Error testing email connectivity:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// AI-powered email insights
router.get('/insights', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;
    
    // Get recent unread important emails
    const importantUnread = await pool.query(`
      SELECT message_id, subject, sender_email, ai_summary, ai_priority
      FROM user_email_messages
      WHERE user_id = $1 
        AND is_read = false 
        AND ai_priority IN ('high', 'medium')
        AND received_at >= NOW() - INTERVAL '${parseInt(days)} days'
      ORDER BY 
        CASE ai_priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        received_at DESC
      LIMIT 10
    `, [userId]);
    
    // Get action-required emails
    const actionRequired = await pool.query(`
      SELECT message_id, subject, sender_email, ai_summary
      FROM user_email_messages
      WHERE user_id = $1 
        AND ai_action_required = true
        AND is_read = false
        AND received_at >= NOW() - INTERVAL '${parseInt(days)} days'
      ORDER BY received_at DESC
      LIMIT 5
    `, [userId]);
    
    // Get email trends
    const trends = await pool.query(`
      SELECT 
        DATE_TRUNC('day', received_at) as date,
        COUNT(*) as total,
        COUNT(CASE WHEN ai_priority = 'high' THEN 1 END) as high_priority,
        COUNT(CASE WHEN ai_action_required = true THEN 1 END) as action_required
      FROM user_email_messages
      WHERE user_id = $1 
        AND received_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('day', received_at)
      ORDER BY date DESC
    `, [userId]);
    
    const insights = {
      important_unread: importantUnread.rows,
      action_required: actionRequired.rows,
      weekly_trends: trends.rows,
      summary: {
        total_important_unread: importantUnread.rows.length,
        total_action_required: actionRequired.rows.length,
        trend_direction: trends.rows.length > 1 ? 
          (trends.rows[0].total > trends.rows[1].total ? 'increasing' : 'decreasing') : 'stable'
      }
    };
    
    res.json({
      success: true,
      insights: insights,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting email insights:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Smart email suggestions
router.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const suggestions = [];
    
    // Check for emails needing responses
    const needsResponse = await pool.query(`
      SELECT COUNT(*) as count
      FROM user_email_messages
      WHERE user_id = $1 
        AND is_read = true
        AND ai_action_required = true
        AND received_at >= NOW() - INTERVAL '7 days'
        AND received_at <= NOW() - INTERVAL '24 hours'
    `, [userId]);
    
    if (parseInt(needsResponse.rows[0].count) > 0) {
      suggestions.push({
        type: 'response_reminder',
        priority: 'medium',
        message: `You have ${needsResponse.rows[0].count} emails that may need responses`,
        action: 'Review action-required emails',
        count: parseInt(needsResponse.rows[0].count)
      });
    }
    
    // Check unread important emails
    const unreadImportant = await pool.query(`
      SELECT COUNT(*) as count
      FROM user_email_messages
      WHERE user_id = $1 
        AND is_read = false
        AND ai_priority = 'high'
    `, [userId]);
    
    if (parseInt(unreadImportant.rows[0].count) > 0) {
      suggestions.push({
        type: 'priority_review',
        priority: 'high',
        message: `You have ${unreadImportant.rows[0].count} unread high-priority emails`,
        action: 'Review high-priority emails',
        count: parseInt(unreadImportant.rows[0].count)
      });
    }
    
    // Email organization suggestion
    const totalUnread = await pool.query(`
      SELECT COUNT(*) as count
      FROM user_email_messages
      WHERE user_id = $1 AND is_read = false
    `, [userId]);
    
    if (parseInt(totalUnread.rows[0].count) > 50) {
      suggestions.push({
        type: 'inbox_organization',
        priority: 'low',
        message: `Consider organizing your inbox - you have ${totalUnread.rows[0].count} unread emails`,
        action: 'Set up email filters or batch process emails',
        count: parseInt(totalUnread.rows[0].count)
      });
    }
    
    res.json({
      success: true,
      suggestions: suggestions,
      total_suggestions: suggestions.length
    });
  } catch (error) {
    console.error('Error getting email suggestions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Email service status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const status = EmailService.getStatus();
    
    // Test connectivity if requested
    const { test_connection = 'false' } = req.query;
    if (test_connection === 'true') {
      const connectivityTest = await EmailService.testConnectivity(userId);
      status.connectivity_test = connectivityTest;
    }
    
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Error getting email service status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
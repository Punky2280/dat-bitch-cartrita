const express = require('express');
const authenticateToken = require('../middleware/authenticateToken');
const PrivacyControlService = require('../services/PrivacyControlService');
const pool = require('../db');

const router = express.Router();

// Get user's consent status
router.get('/consent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const consent = await PrivacyControlService.getUserConsent(userId);
    
    res.json({
      success: true,
      consent: consent
    });
  } catch (error) {
    console.error('Error fetching user consent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update user consent
router.post('/consent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { consent_records } = req.body;

    if (!Array.isArray(consent_records)) {
      return res.status(400).json({
        success: false,
        error: 'consent_records must be an array'
      });
    }

    const updatedConsent = [];
    
    for (const record of consent_records) {
      if (!record.consent_type || typeof record.consent_given !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Each consent record must have consent_type and consent_given (boolean)'
        });
      }

      const consent = await PrivacyControlService.recordConsent(
        userId,
        record.consent_type,
        record.consent_given,
        record.details || {},
        req.ip,
        req.get('User-Agent')
      );
      
      updatedConsent.push(consent);
    }

    res.json({
      success: true,
      message: `${updatedConsent.length} consent records updated`,
      consent: updatedConsent
    });
  } catch (error) {
    console.error('Error updating user consent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user's data retention policies
router.get('/retention', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const policies = await PrivacyControlService.getUserRetentionPolicies(userId);
    
    res.json({
      success: true,
      retention_policies: policies
    });
  } catch (error) {
    console.error('Error fetching retention policies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update user's data retention policy
router.put('/retention/:dataType', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { dataType } = req.params;
    const { retention_days, auto_delete, anonymize_before_delete } = req.body;

    if (typeof retention_days !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'retention_days must be a number (-1 for indefinite, 0+ for days)'
      });
    }

    const validDataTypes = [
      'calendar_events', 'email_messages', 'contacts', 'notifications',
      'contact_interactions', 'user_sessions', 'api_logs', 'error_logs',
      'chat_conversations'
    ];

    if (!validDataTypes.includes(dataType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid data type. Valid types: ${validDataTypes.join(', ')}`
      });
    }

    const policy = await PrivacyControlService.updateRetentionPolicy(
      userId,
      dataType,
      retention_days,
      auto_delete !== false, // Default to true
      anonymize_before_delete === true // Default to false
    );

    res.json({
      success: true,
      message: 'Retention policy updated successfully',
      policy: policy
    });
  } catch (error) {
    console.error('Error updating retention policy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Request data export
router.post('/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { export_type = 'full', data_types = [] } = req.body;

    if (export_type !== 'full' && export_type !== 'partial') {
      return res.status(400).json({
        success: false,
        error: 'export_type must be "full" or "partial"'
      });
    }

    if (export_type === 'partial' && data_types.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'data_types array is required for partial exports'
      });
    }

    // Check for existing pending export requests
    const pendingResult = await pool.query(`
      SELECT id FROM user_data_export_requests
      WHERE user_id = $1 AND status IN ('pending', 'processing')
    `, [userId]);

    if (pendingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'You already have a pending export request. Please wait for it to complete.'
      });
    }

    const exportRequest = await PrivacyControlService.requestDataExport(
      userId,
      export_type,
      data_types
    );

    res.json({
      success: true,
      message: 'Data export request created successfully',
      export_request: {
        id: exportRequest.id,
        export_type: exportRequest.export_type,
        data_types: exportRequest.data_types,
        status: exportRequest.status,
        requested_at: exportRequest.requested_at,
        expires_at: exportRequest.expires_at
      }
    });
  } catch (error) {
    console.error('Error requesting data export:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get export request status
router.get('/export/:requestId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    const result = await pool.query(`
      SELECT id, export_type, data_types, status, file_size, download_count,
             requested_at, completed_at, expires_at, error_message
      FROM user_data_export_requests
      WHERE id = $1 AND user_id = $2
    `, [requestId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Export request not found'
      });
    }

    const exportRequest = result.rows[0];

    res.json({
      success: true,
      export_request: exportRequest
    });
  } catch (error) {
    console.error('Error fetching export request:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download export file
router.get('/export/:requestId/download', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    const result = await pool.query(`
      SELECT file_path, download_count, expires_at, status
      FROM user_data_export_requests
      WHERE id = $1 AND user_id = $2 AND status = 'completed'
    `, [requestId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Export file not found or not ready'
      });
    }

    const exportRequest = result.rows[0];

    // Check if export has expired
    if (new Date() > new Date(exportRequest.expires_at)) {
      return res.status(410).json({
        success: false,
        error: 'Export file has expired'
      });
    }

    // Update download count
    await pool.query(`
      UPDATE user_data_export_requests 
      SET download_count = download_count + 1
      WHERE id = $1
    `, [requestId]);

    // Send file
    res.download(exportRequest.file_path, `user_data_export_${userId}.json`, (err) => {
      if (err) {
        console.error('Error downloading export file:', err);
        res.status(500).json({
          success: false,
          error: 'Error downloading file'
        });
      }
    });

    await PrivacyControlService.logDataAccess(userId, userId, 'export_file', 'read', requestId, 'file_download', req.ip, req.get('User-Agent'));

  } catch (error) {
    console.error('Error downloading export file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Request data deletion
router.post('/delete', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { deletion_type = 'full_account', data_types = [], reason = '' } = req.body;

    if (deletion_type !== 'full_account' && deletion_type !== 'partial_data') {
      return res.status(400).json({
        success: false,
        error: 'deletion_type must be "full_account" or "partial_data"'
      });
    }

    if (deletion_type === 'partial_data' && data_types.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'data_types array is required for partial data deletion'
      });
    }

    // Check for existing pending deletion requests
    const pendingResult = await pool.query(`
      SELECT id FROM user_data_deletion_requests
      WHERE user_id = $1 AND status IN ('pending', 'processing')
    `, [userId]);

    if (pendingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'You already have a pending deletion request.'
      });
    }

    const deletionRequest = await PrivacyControlService.requestDataDeletion(
      userId,
      deletion_type,
      data_types,
      reason
    );

    res.json({
      success: true,
      message: 'Data deletion request created. Please check your email for verification instructions.',
      deletion_request: {
        id: deletionRequest.id,
        deletion_type: deletionRequest.deletion_type,
        data_types: deletionRequest.data_types,
        status: deletionRequest.status,
        requested_at: deletionRequest.requested_at
      }
    });
  } catch (error) {
    console.error('Error requesting data deletion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Verify and process deletion request
router.post('/delete/:requestId/verify', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { verification_token } = req.body;

    if (!verification_token) {
      return res.status(400).json({
        success: false,
        error: 'verification_token is required'
      });
    }

    const success = await PrivacyControlService.verifyAndProcessDeletion(
      requestId,
      verification_token
    );

    if (success) {
      res.json({
        success: true,
        message: 'Deletion request verified and processing started'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid verification token'
      });
    }
  } catch (error) {
    console.error('Error verifying deletion request:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user's data access log
router.get('/access-log', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      access_type,
      data_type,
      days = 30,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {
      access_type,
      data_type,
      days: parseInt(days),
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const accessLog = await PrivacyControlService.getUserAccessLog(userId, filters);

    res.json({
      success: true,
      access_log: accessLog,
      count: accessLog.length,
      filters: filters
    });
  } catch (error) {
    console.error('Error fetching access log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get privacy dashboard summary
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get consent summary
    const consentResult = await pool.query(`
      SELECT consent_type, consent_given, consent_date
      FROM user_consent_records
      WHERE user_id = $1
      ORDER BY consent_date DESC
    `, [userId]);

    // Get retention policies summary
    const retentionResult = await pool.query(`
      SELECT data_type, retention_days, auto_delete
      FROM user_data_retention_policies
      WHERE user_id = $1
      ORDER BY data_type
    `, [userId]);

    // Get recent access activity
    const accessResult = await pool.query(`
      SELECT data_type, access_type, COUNT(*) as access_count
      FROM user_data_access_log
      WHERE user_id = $1 AND access_date >= NOW() - INTERVAL '7 days'
      GROUP BY data_type, access_type
      ORDER BY access_count DESC
      LIMIT 10
    `, [userId]);

    // Get pending requests
    const pendingExports = await pool.query(`
      SELECT id, status, requested_at
      FROM user_data_export_requests
      WHERE user_id = $1 AND status IN ('pending', 'processing')
    `, [userId]);

    const pendingDeletions = await pool.query(`
      SELECT id, status, requested_at
      FROM user_data_deletion_requests
      WHERE user_id = $1 AND status IN ('pending', 'processing')
    `, [userId]);

    // Get data usage statistics
    const dataStats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM user_calendar_events WHERE user_id = $1) as calendar_events,
        (SELECT COUNT(*) FROM user_email_messages WHERE user_id = $1) as email_messages,
        (SELECT COUNT(*) FROM user_contacts WHERE user_id = $1) as contacts,
        (SELECT COUNT(*) FROM user_notifications WHERE user_id = $1) as notifications,
        (SELECT COUNT(*) FROM conversations WHERE user_id = $1) as conversations
    `, [userId]);

    res.json({
      success: true,
      dashboard: {
        consent_records: consentResult.rows,
        retention_policies: retentionResult.rows,
        recent_access_activity: accessResult.rows,
        pending_export_requests: pendingExports.rows,
        pending_deletion_requests: pendingDeletions.rows,
        data_usage_statistics: dataStats.rows[0]
      }
    });
  } catch (error) {
    console.error('Error fetching privacy dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Privacy service status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = PrivacyControlService.getStatus();
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Error getting privacy service status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get available data types for export/deletion
router.get('/data-types', authenticateToken, async (req, res) => {
  try {
    const dataTypes = [
      {
        name: 'calendar_events',
        description: 'Calendar events and appointments',
        includes: ['titles', 'descriptions', 'attendees', 'locations', 'times']
      },
      {
        name: 'email_messages',
        description: 'Email messages and metadata',
        includes: ['subjects', 'senders', 'recipients', 'content', 'timestamps']
      },
      {
        name: 'contacts',
        description: 'Contact information and details',
        includes: ['names', 'emails', 'phone numbers', 'addresses', 'organizations']
      },
      {
        name: 'notifications',
        description: 'System notifications and alerts',
        includes: ['notification content', 'timestamps', 'read status']
      },
      {
        name: 'contact_interactions',
        description: 'Records of contact interactions',
        includes: ['interaction types', 'descriptions', 'dates', 'metadata']
      },
      {
        name: 'conversations',
        description: 'Chat conversations with the AI assistant',
        includes: ['messages', 'responses', 'timestamps', 'context']
      }
    ];

    res.json({
      success: true,
      data_types: dataTypes
    });
  } catch (error) {
    console.error('Error fetching data types:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
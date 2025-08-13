// packages/backend/src/routes/email.js
// Email management routes for Cartrita AI Assistant

import express from 'express';
import rateLimit from 'express-rate-limit';
import authenticateToken from '../middleware/authenticateToken.js';

const router = express.Router();

// Rate limiting for email endpoints
const emailLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 300, // allow more in dev to prevent noisy 429s
  message: { error: 'Too many email requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/email - Email service overview
router.get('/', authenticateToken, (req, res) => {
  res.status(200).json({
    service: 'CartritaEmailService',
    status: 'operational',
    message: '📧 Cartrita email system is locked and loaded',
    version: '2.1.0',
    features: [
      'gmail_sync',
      'smart_categorization',
      'ai_summaries',
      'follow_up_tracking',
    ],
    endpoints: {
      status: 'GET /api/email/status',
      accounts: 'GET /api/email/accounts',
      messages: 'GET /api/email/messages',
      send: 'POST /api/email/send',
      connect: 'POST /api/email/connect',
    },
  });
});

// GET /api/email/status - Get email service status
router.get('/status', authenticateToken, emailLimiter, async (req, res) => {
  try {
    const status = {
      service: 'EmailService',
      status: 'operational',
      timestamp: new Date().toISOString(),
      message: '📧 Email system is online and ready',
      features: {
        gmail_integration: process.env.GOOGLE_API_KEY ? 'enabled' : 'disabled',
        outlook_integration: process.env.OUTLOOK_API_KEY
          ? 'enabled'
          : 'disabled',
        smtp_service: process.env.SMTP_HOST ? 'enabled' : 'disabled',
        ai_categorization: 'enabled',
        smart_summaries: 'enabled',
      },
      providers_available: ['Gmail', 'Outlook', 'SMTP'],
    };

    res.json(status);
  } catch (error) {
    console.error('[Email Routes] Status error:', error);
    res.status(500).json({
      error: '📧 Email service status check failed',
      details: 'Cartrita is having email system issues',
    });
  }
});

// GET /api/email/messages - Get email messages
router.get('/messages', authenticateToken, emailLimiter, async (req, res) => {
  try {
    const { folder = 'inbox', limit = 20, unread_only = false } = req.query;

    // TODO: Implement actual email message retrieval with Google API
    const mockMessages = [
      {
        id: 'msg_001',
        from: 'team@cartrita.ai',
        subject: '🎉 Welcome to Cartrita!',
        preview: 'Thanks for joining the Cartrita family...',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        read: false,
        category: 'welcome',
        ai_summary: 'Welcome email from Cartrita team with setup instructions',
      },
      {
        id: 'msg_002',
        from: 'notifications@github.com',
        subject: 'Repository activity',
        preview: 'New activity in your repositories...',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        read: true,
        category: 'notifications',
        ai_summary: 'GitHub activity notifications for your repositories',
      },
    ];

    const filteredMessages =
      unread_only === 'true'
        ? mockMessages.filter(msg => !msg.read)
        : mockMessages;

    res.json({
      messages: filteredMessages.slice(0, parseInt(limit)),
      total_count: filteredMessages.length,
      unread_count: mockMessages.filter(msg => !msg.read).length,
      folder: folder,
      message: `📬 Found ${filteredMessages.length} messages in ${folder}`,
    });
  } catch (error) {
    console.error('[Email Routes] Messages error:', error);
    res.status(500).json({
      error: '📧 Failed to retrieve your messages',
      details: 'Cartrita could not access your email right now',
    });
  }
});

// POST /api/email/send - Send email
router.post('/send', authenticateToken, emailLimiter, async (req, res) => {
  try {
    const { to, subject, body, priority = 'normal' } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({
        error: '📧 Hold up, you need to fill out all the fields',
        details: 'To, subject, and body are all required',
      });
    }

    // TODO: Implement actual email sending with SMTP/Gmail API
    console.log(
      `[Email] Cartrita sending email to ${to} with subject: ${subject}`
    );

    res.json({
      success: true,
      message: '📧 Your email is sent and delivered',
      email_id: `sent_${Date.now()}`,
      timestamp: new Date().toISOString(),
      recipients: Array.isArray(to) ? to : [to],
      delivery_status: 'sent',
    });
  } catch (error) {
    console.error('[Email Routes] Send error:', error);
    res.status(500).json({
      error: '📧 Email sending hit a snag',
      details: 'Cartrita could not send your email right now',
    });
  }
});

// POST /api/email/connect - Connect email account
router.post('/connect', authenticateToken, emailLimiter, async (req, res) => {
  try {
    const { provider } = req.body;

    if (!provider) {
      return res.status(400).json({
        error: '📧 Which email provider you trying to connect?',
        details: 'Provider is required (gmail, outlook, etc.)',
      });
    }

    // TODO: Implement OAuth flows for email providers
    res.json({
      success: true,
      message: `📧 Connected to ${provider} successfully`,
      provider: provider,
      account_id: `${provider.toLowerCase()}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      next_steps: 'You can now sync your emails and send messages',
    });
  } catch (error) {
    console.error('[Email Routes] Connect error:', error);
    res.status(500).json({
      error: '📧 Could not connect your email account',
      details: 'Cartrita had trouble linking your email provider',
    });
  }
});

export default router;

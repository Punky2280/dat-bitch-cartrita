// packages/backend/src/agi/communication/NotificationAgent.js

const BaseAgent = require('../../system/BaseAgent');
const MessageBus = require('../../system/EnhancedMessageBus');

class NotificationAgent extends BaseAgent {
  constructor() {
    super('NotificationAgent', 'main', [
      'notification_management',
      'alert_prioritization',
      'multi_channel_delivery',
      'notification_scheduling',
      'user_preference_handling',
      'escalation_management'
    ]);

    this.setupMessageHandlers();
    this.initializeNotificationEngine();
    this.status = 'ready';
    console.log('[NotificationAgent.main] Agent initialized and ready');
  }

  setupMessageHandlers() {
    // Call parent class method to set up MCP message handlers
    super.setupMessageHandlers();
    
    // Set up notification-specific message handlers
    MessageBus.on('notification.send', this.sendNotification.bind(this));
    MessageBus.on('notification.schedule', this.scheduleNotification.bind(this));
    MessageBus.on('notification.batch', this.sendBatchNotifications.bind(this));
    MessageBus.on('alert.escalate', this.escalateAlert.bind(this));
    MessageBus.on('preferences.update', this.updatePreferences.bind(this));
    MessageBus.on(`${this.agentId}.health`, this.healthCheck.bind(this));
  }

  initializeNotificationEngine() {
    // Notification channels and their configurations
    this.channels = new Map([
      ['email', {
        enabled: true,
        priority: 'medium',
        rateLimit: 100, // per hour
        templates: new Map(),
        delivery_time: 2000 // ms
      }],
      ['sms', {
        enabled: true,
        priority: 'high',
        rateLimit: 20, // per hour
        templates: new Map(),
        delivery_time: 5000 // ms
      }],
      ['push', {
        enabled: true,
        priority: 'high',
        rateLimit: 200, // per hour
        templates: new Map(),
        delivery_time: 1000 // ms
      }],
      ['slack', {
        enabled: true,
        priority: 'medium',
        rateLimit: 50, // per hour
        templates: new Map(),
        delivery_time: 3000 // ms
      }],
      ['webhook', {
        enabled: true,
        priority: 'low',
        rateLimit: 1000, // per hour
        templates: new Map(),
        delivery_time: 2000 // ms
      }],
      ['in_app', {
        enabled: true,
        priority: 'low',
        rateLimit: 500, // per hour
        templates: new Map(),
        delivery_time: 100 // ms
      }]
    ]);

    // Priority levels and their configurations
    this.priorityLevels = new Map([
      ['critical', { urgency: 5, channels: ['sms', 'push', 'email'], escalation_time: 300000 }], // 5 minutes
      ['high', { urgency: 4, channels: ['push', 'email', 'slack'], escalation_time: 900000 }], // 15 minutes
      ['medium', { urgency: 3, channels: ['email', 'in_app'], escalation_time: 3600000 }], // 1 hour
      ['low', { urgency: 2, channels: ['in_app', 'email'], escalation_time: 86400000 }], // 24 hours
      ['info', { urgency: 1, channels: ['in_app'], escalation_time: null }]
    ]);

    // Notification templates
    this.templates = new Map([
      ['system_alert', {
        subject: 'System Alert: {{alert_type}}',
        body: 'Alert: {{message}}\nTime: {{timestamp}}\nSeverity: {{severity}}',
        channels: ['email', 'slack']
      }],
      ['security_incident', {
        subject: '🚨 Security Incident Detected',
        body: 'Security incident: {{incident_type}}\nDescription: {{description}}\nAction required: {{action}}',
        channels: ['sms', 'push', 'email']
      }],
      ['task_completion', {
        subject: 'Task Completed: {{task_name}}',
        body: 'Your task "{{task_name}}" has been completed successfully.\nResults: {{results}}',
        channels: ['push', 'in_app']
      }],
      ['agent_status', {
        subject: 'Agent Status Update: {{agent_name}}',
        body: 'Agent {{agent_name}} status changed to {{status}}\nReason: {{reason}}',
        channels: ['slack', 'in_app']
      }],
      ['user_activity', {
        subject: 'Activity Update',
        body: 'New activity: {{activity}}\nUser: {{user}}\nTime: {{timestamp}}',
        channels: ['in_app']
      }]
    ]);

    // User preferences storage
    this.userPreferences = new Map();
    
    // Notification queue and scheduling
    this.notificationQueue = [];
    this.scheduledNotifications = new Map();
    this.deliveryHistory = [];
    
    // Rate limiting tracking
    this.rateLimitCounters = new Map();
    
    // Metrics
    this.notificationMetrics = {
      notifications_sent: 0,
      notifications_scheduled: 0,
      notifications_failed: 0,
      escalations_triggered: 0,
      channels_used: new Map()
    };

    // Start background processing
    this.startNotificationProcessor();
    this.startRateLimitReset();
  }

  async sendNotification(message) {
    try {
      const {
        recipient,
        title,
        body,
        priority = 'medium',
        channels = null,
        template = null,
        data = {},
        options = {}
      } = message.payload;

      const notification = await this.processNotification({
        recipient,
        title,
        body,
        priority,
        channels,
        template,
        data,
        options,
        timestamp: new Date().toISOString()
      });

      this.notificationMetrics.notifications_sent++;

      MessageBus.publish(`notification.sent.${message.id}`, {
        status: 'completed',
        notification,
        delivery_status: notification.delivery_status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[NotificationAgent] Error sending notification:', error);
      this.notificationMetrics.notifications_failed++;
      MessageBus.publish(`notification.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async processNotification(notificationData) {
    const {
      recipient,
      title,
      body,
      priority,
      channels,
      template,
      data,
      options
    } = notificationData;

    // Get user preferences
    const userPrefs = this.getUserPreferences(recipient);
    
    // Determine channels to use
    const targetChannels = this.determineChannels(priority, channels, userPrefs);
    
    // Apply template if specified
    let processedNotification = { title, body };
    if (template && this.templates.has(template)) {
      processedNotification = this.applyTemplate(template, data);
    }

    // Check rate limits
    const allowedChannels = this.checkRateLimits(recipient, targetChannels);

    // Create notification object
    const notification = {
      id: this.generateNotificationId(),
      recipient,
      title: processedNotification.title,
      body: processedNotification.body,
      priority,
      channels: allowedChannels,
      template,
      data,
      options,
      created_at: new Date().toISOString(),
      delivery_status: new Map(),
      escalation_scheduled: false
    };

    // Queue for delivery
    if (options.immediate !== false) {
      await this.deliverNotification(notification);
    } else {
      this.queueNotification(notification);
    }

    // Schedule escalation if needed
    if (this.shouldScheduleEscalation(priority, options)) {
      this.scheduleEscalation(notification);
    }

    return notification;
  }

  async deliverNotification(notification) {
    const deliveryPromises = notification.channels.map(async (channel) => {
      try {
        const result = await this.deliverToChannel(notification, channel);
        notification.delivery_status.set(channel, {
          status: 'delivered',
          timestamp: new Date().toISOString(),
          result
        });
        
        // Update channel usage metrics
        const channelCount = this.notificationMetrics.channels_used.get(channel) || 0;
        this.notificationMetrics.channels_used.set(channel, channelCount + 1);
        
      } catch (error) {
        notification.delivery_status.set(channel, {
          status: 'failed',
          timestamp: new Date().toISOString(),
          error: error.message
        });
        console.error(`[NotificationAgent] Delivery failed for channel ${channel}:`, error);
      }
    });

    await Promise.allSettled(deliveryPromises);
    
    // Store in delivery history
    this.deliveryHistory.push({
      ...notification,
      delivered_at: new Date().toISOString()
    });

    // Limit history size
    if (this.deliveryHistory.length > 1000) {
      this.deliveryHistory = this.deliveryHistory.slice(-500);
    }
  }

  async deliverToChannel(notification, channel) {
    const channelConfig = this.channels.get(channel);
    if (!channelConfig || !channelConfig.enabled) {
      throw new Error(`Channel ${channel} is not available`);
    }

    // Simulate delivery delay
    await new Promise(resolve => setTimeout(resolve, channelConfig.delivery_time));

    switch (channel) {
      case 'email':
        return await this.sendEmail(notification);
      case 'sms':
        return await this.sendSMS(notification);
      case 'push':
        return await this.sendPushNotification(notification);
      case 'slack':
        return await this.sendSlackMessage(notification);
      case 'webhook':
        return await this.sendWebhook(notification);
      case 'in_app':
        return await this.sendInAppNotification(notification);
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }

  async sendEmail(notification) {
    // Email delivery simulation
    console.log(`[NotificationAgent] Sending email to ${notification.recipient}`);
    return {
      channel: 'email',
      message_id: `email_${Date.now()}`,
      status: 'sent'
    };
  }

  async sendSMS(notification) {
    // SMS delivery simulation
    console.log(`[NotificationAgent] Sending SMS to ${notification.recipient}`);
    return {
      channel: 'sms',
      message_id: `sms_${Date.now()}`,
      status: 'sent'
    };
  }

  async sendPushNotification(notification) {
    // Push notification delivery simulation
    console.log(`[NotificationAgent] Sending push notification to ${notification.recipient}`);
    
    // Emit via MessageBus for real-time delivery
    MessageBus.publish('realtime.push', {
      recipient: notification.recipient,
      title: notification.title,
      body: notification.body,
      data: notification.data
    });

    return {
      channel: 'push',
      message_id: `push_${Date.now()}`,
      status: 'sent'
    };
  }

  async sendSlackMessage(notification) {
    // Slack delivery simulation
    console.log(`[NotificationAgent] Sending Slack message for ${notification.recipient}`);
    return {
      channel: 'slack',
      message_id: `slack_${Date.now()}`,
      status: 'sent'
    };
  }

  async sendWebhook(notification) {
    // Webhook delivery simulation
    console.log(`[NotificationAgent] Sending webhook for ${notification.recipient}`);
    return {
      channel: 'webhook',
      message_id: `webhook_${Date.now()}`,
      status: 'sent'
    };
  }

  async sendInAppNotification(notification) {
    // In-app notification delivery
    console.log(`[NotificationAgent] Sending in-app notification to ${notification.recipient}`);
    
    // Emit via MessageBus for real-time in-app delivery
    MessageBus.publish('realtime.notification', {
      recipient: notification.recipient,
      title: notification.title,
      body: notification.body,
      priority: notification.priority,
      timestamp: notification.created_at
    });

    return {
      channel: 'in_app',
      message_id: `inapp_${Date.now()}`,
      status: 'sent'
    };
  }

  async scheduleNotification(message) {
    try {
      const { scheduledTime, ...notificationData } = message.payload;
      
      const scheduleId = this.generateNotificationId();
      const scheduledNotification = {
        id: scheduleId,
        scheduledTime: new Date(scheduledTime),
        ...notificationData
      };

      this.scheduledNotifications.set(scheduleId, scheduledNotification);
      this.notificationMetrics.notifications_scheduled++;

      MessageBus.publish(`notification.scheduled.${message.id}`, {
        status: 'scheduled',
        schedule_id: scheduleId,
        scheduled_time: scheduledTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[NotificationAgent] Error scheduling notification:', error);
      MessageBus.publish(`notification.schedule.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async sendBatchNotifications(message) {
    try {
      const { notifications, batchOptions = {} } = message.payload;
      
      if (!notifications || !Array.isArray(notifications)) {
        throw new Error('Invalid notifications array provided');
      }

      const batchResult = {
        batch_id: this.generateNotificationId(),
        total_notifications: notifications.length,
        successful: 0,
        failed: 0,
        results: []
      };

      // Process notifications in batches
      const batchSize = batchOptions.batch_size || 10;
      const delay = batchOptions.delay_ms || 100;

      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (notification) => {
          try {
            const result = await this.processNotification(notification);
            batchResult.successful++;
            return { success: true, notification_id: result.id, result };
          } catch (error) {
            batchResult.failed++;
            return { success: false, error: error.message, notification: notification };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        batchResult.results.push(...batchResults.map(r => r.value || r.reason));

        // Add delay between batches if specified
        if (delay > 0 && i + batchSize < notifications.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      MessageBus.publish(`notification.batch.result.${message.id}`, {
        status: 'completed',
        batch_result: batchResult,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[NotificationAgent] Error sending batch notifications:', error);
      MessageBus.publish(`notification.batch.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async escalateAlert(message) {
    try {
      const { originalNotification, escalationLevel, reason } = message.payload;
      
      const escalation = await this.performEscalation(
        originalNotification,
        escalationLevel,
        reason
      );

      this.notificationMetrics.escalations_triggered++;

      MessageBus.publish(`alert.escalated.${message.id}`, {
        status: 'escalated',
        escalation,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[NotificationAgent] Error escalating alert:', error);
      MessageBus.publish(`alert.escalation.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async performEscalation(originalNotification, escalationLevel, reason) {
    // Create escalated notification with higher priority
    const escalatedNotification = {
      ...originalNotification,
      id: this.generateNotificationId(),
      title: `🚨 ESCALATED: ${originalNotification.title}`,
      body: `ESCALATION REASON: ${reason}\n\nORIGINAL MESSAGE:\n${originalNotification.body}`,
      priority: 'critical',
      channels: ['sms', 'push', 'email'], // Use high-priority channels
      escalation_level: escalationLevel,
      original_notification_id: originalNotification.id,
      created_at: new Date().toISOString()
    };

    await this.deliverNotification(escalatedNotification);

    return escalatedNotification;
  }

  determineChannels(priority, requestedChannels, userPrefs) {
    // Start with priority-based channels
    const priorityConfig = this.priorityLevels.get(priority);
    let channels = requestedChannels || priorityConfig.channels;

    // Apply user preferences
    if (userPrefs && userPrefs.disabled_channels) {
      channels = channels.filter(channel => !userPrefs.disabled_channels.includes(channel));
    }

    if (userPrefs && userPrefs.preferred_channels) {
      // Prioritize user's preferred channels
      const preferred = channels.filter(channel => userPrefs.preferred_channels.includes(channel));
      const others = channels.filter(channel => !userPrefs.preferred_channels.includes(channel));
      channels = [...preferred, ...others];
    }

    return channels;
  }

  applyTemplate(templateName, data) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const processTemplate = (text, data) => {
      return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] || match;
      });
    };

    return {
      title: processTemplate(template.subject, data),
      body: processTemplate(template.body, data)
    };
  }

  checkRateLimits(recipient, channels) {
    const now = Date.now();
    const hourAgo = now - 3600000; // 1 hour

    return channels.filter(channel => {
      const channelConfig = this.channels.get(channel);
      const key = `${recipient}:${channel}`;
      
      if (!this.rateLimitCounters.has(key)) {
        this.rateLimitCounters.set(key, []);
      }

      const counter = this.rateLimitCounters.get(key);
      
      // Remove old entries
      const recentEntries = counter.filter(timestamp => timestamp > hourAgo);
      this.rateLimitCounters.set(key, recentEntries);

      // Check if under rate limit
      if (recentEntries.length < channelConfig.rateLimit) {
        recentEntries.push(now);
        return true;
      }

      console.warn(`[NotificationAgent] Rate limit exceeded for ${recipient} on ${channel}`);
      return false;
    });
  }

  getUserPreferences(recipient) {
    return this.userPreferences.get(recipient) || {
      disabled_channels: [],
      preferred_channels: ['push', 'in_app'],
      quiet_hours: { start: '22:00', end: '08:00' },
      timezone: 'UTC'
    };
  }

  shouldScheduleEscalation(priority, options) {
    return priority === 'critical' || priority === 'high' || options.escalate === true;
  }

  scheduleEscalation(notification) {
    const priorityConfig = this.priorityLevels.get(notification.priority);
    if (!priorityConfig.escalation_time) return;

    setTimeout(() => {
      if (!this.isNotificationAcknowledged(notification.id)) {
        this.performEscalation(notification, 1, 'No acknowledgment received');
      }
    }, priorityConfig.escalation_time);

    notification.escalation_scheduled = true;
  }

  isNotificationAcknowledged(notificationId) {
    // Check if notification has been acknowledged
    // This would integrate with user acknowledgment system
    return false; // Simplified for now
  }

  async updatePreferences(message) {
    try {
      const { userId, preferences } = message.payload;
      
      if (!userId || !preferences) {
        throw new Error('User ID and preferences are required');
      }

      // Validate preferences structure
      const validatedPreferences = this.validatePreferences(preferences);
      
      // Update user preferences
      this.userPreferences.set(userId, {
        ...this.getUserPreferences(userId),
        ...validatedPreferences,
        updated_at: new Date().toISOString()
      });

      MessageBus.publish(`preferences.updated.${message.id}`, {
        status: 'completed',
        user_id: userId,
        updated_preferences: validatedPreferences,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[NotificationAgent] Error updating preferences:', error);
      MessageBus.publish(`preferences.update.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  validatePreferences(preferences) {
    const validChannels = Array.from(this.channels.keys());
    const validated = {};

    // Validate disabled channels
    if (preferences.disabled_channels) {
      validated.disabled_channels = preferences.disabled_channels.filter(channel => 
        validChannels.includes(channel)
      );
    }

    // Validate preferred channels
    if (preferences.preferred_channels) {
      validated.preferred_channels = preferences.preferred_channels.filter(channel => 
        validChannels.includes(channel)
      );
    }

    // Validate quiet hours
    if (preferences.quiet_hours) {
      if (preferences.quiet_hours.start && preferences.quiet_hours.end) {
        validated.quiet_hours = {
          start: preferences.quiet_hours.start,
          end: preferences.quiet_hours.end
        };
      }
    }

    // Validate timezone
    if (preferences.timezone) {
      validated.timezone = preferences.timezone;
    }

    return validated;
  }

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  queueNotification(notification) {
    this.notificationQueue.push(notification);
  }

  startNotificationProcessor() {
    setInterval(() => {
      this.processNotificationQueue();
      this.processScheduledNotifications();
    }, 5000); // Process every 5 seconds
  }

  async processNotificationQueue() {
    if (this.notificationQueue.length === 0) return;

    const notifications = this.notificationQueue.splice(0, 10); // Process up to 10 at a time
    
    for (const notification of notifications) {
      try {
        await this.deliverNotification(notification);
      } catch (error) {
        console.error('[NotificationAgent] Error processing queued notification:', error);
      }
    }
  }

  processScheduledNotifications() {
    const now = new Date();
    
    for (const [scheduleId, notification] of this.scheduledNotifications) {
      if (notification.scheduledTime <= now) {
        this.processNotification(notification);
        this.scheduledNotifications.delete(scheduleId);
      }
    }
  }

  startRateLimitReset() {
    // Reset rate limit counters every hour
    setInterval(() => {
      this.rateLimitCounters.clear();
    }, 3600000); // 1 hour
  }

  healthCheck() {
    return {
      status: this.status,
      agentId: this.agentId,
      capabilities: this.capabilities,
      metrics: {
        notifications_sent: this.notificationMetrics.notifications_sent,
        notifications_scheduled: this.notificationMetrics.notifications_scheduled,
        notifications_failed: this.notificationMetrics.notifications_failed,
        escalations_triggered: this.notificationMetrics.escalations_triggered,
        queued_notifications: this.notificationQueue.length,
        scheduled_notifications: this.scheduledNotifications.size,
        delivery_history_size: this.deliveryHistory.length
      },
      channels: Array.from(this.channels.entries()).map(([name, config]) => ({
        name,
        enabled: config.enabled,
        rate_limit: config.rateLimit,
        usage: this.notificationMetrics.channels_used.get(name) || 0
      })),
      templates: Array.from(this.templates.keys()),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new NotificationAgent();
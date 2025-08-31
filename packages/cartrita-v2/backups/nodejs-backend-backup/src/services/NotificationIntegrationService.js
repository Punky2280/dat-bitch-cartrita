// NotificationIntegrationService.js
// Integrates monitoring alerts with notification system

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class NotificationIntegrationService {
  constructor() {
    this.config = null;
    this.webhookQueue = [];
    this.isProcessingQueue = false;
    this.loadConfiguration();
    this.startQueueProcessor();
  }

  async loadConfiguration() {
    try {
      const configPath = path.join(process.cwd(), 'monitoring-integration.json');
      const configData = await fs.readFile(configPath, 'utf8');
      this.config = JSON.parse(configData);
      console.log('[NotificationIntegration] Configuration loaded successfully');
    } catch (error) {
      console.warn('[NotificationIntegration] Could not load config, using defaults:', error.message);
      this.config = this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      notification_preferences: {
        channels: {
          desktop: { enabled: true, priority_filter: ["medium", "high", "critical"] },
          webhook: {
            enabled: true,
            endpoints: {
              slack: {
                url: process.env.SLACK_WEBHOOK_URL,
                priority_filter: ["medium", "high", "critical"],
                categories: ["system", "security", "agent"]
              }
            }
          }
        },
        routing_rules: {
          system: {
            low: ["desktop"],
            medium: ["desktop", "webhook.slack"],
            high: ["desktop", "webhook.slack"],
            critical: ["desktop", "webhook.slack"]
          }
        }
      }
    };
  }

  async sendNotification(notification) {
    if (!this.config) {
      console.warn('[NotificationIntegration] Config not loaded, skipping notification');
      return;
    }

    const { category = 'system', priority = 'medium', type = 'info', title, message } = notification;
    
    // Get routing rules for this category and priority
    const routingRules = this.config.notification_preferences.routing_rules[category];
    const channels = routingRules ? routingRules[priority] || [] : ['desktop'];

    console.log(`[NotificationIntegration] Routing ${category}:${priority} notification to:`, channels);

    // Process each channel
    for (const channel of channels) {
      try {
        await this.sendToChannel(channel, notification);
      } catch (error) {
        console.error(`[NotificationIntegration] Failed to send to ${channel}:`, error.message);
      }
    }
  }

  async sendToChannel(channel, notification) {
    const { title, message, type, category, priority, metadata } = notification;

    switch (channel) {
      case 'desktop':
        // Desktop notifications are handled by the frontend
        console.log(`[NotificationIntegration] Desktop notification: ${title}`);
        break;

      case 'webhook.slack':
        await this.sendSlackWebhook(notification);
        break;

      case 'webhook.discord':
        await this.sendDiscordWebhook(notification);
        break;

      case 'webhook.teams':
        await this.sendTeamsWebhook(notification);
        break;

      case 'email':
        await this.sendEmailNotification(notification);
        break;

      case 'sms':
        await this.sendSMSNotification(notification);
        break;

      default:
        console.warn(`[NotificationIntegration] Unknown channel: ${channel}`);
    }
  }

  async sendSlackWebhook(notification) {
    const webhookUrl = this.config.notification_preferences.channels.webhook?.endpoints?.slack?.url;
    if (!webhookUrl || webhookUrl === '${SLACK_WEBHOOK_URL}') {
      console.warn('[NotificationIntegration] Slack webhook URL not configured');
      return;
    }

    const { title, message, type, priority } = notification;
    const color = this.getSlackColor(type, priority);
    const emoji = this.getSlackEmoji(type, priority);

    const payload = {
      text: `${emoji} *${title}*`,
      attachments: [
        {
          color: color,
          fields: [
            {
              title: "Message",
              value: message,
              short: false
            },
            {
              title: "Priority",
              value: priority.toUpperCase(),
              short: true
            },
            {
              title: "Type",
              value: type.toUpperCase(),
              short: true
            },
            {
              title: "Timestamp",
              value: new Date().toISOString(),
              short: true
            }
          ]
        }
      ]
    };

    this.queueWebhook('slack', webhookUrl, payload);
  }

  async sendDiscordWebhook(notification) {
    const webhookUrl = this.config.notification_preferences.channels.webhook?.endpoints?.discord?.url;
    if (!webhookUrl || webhookUrl === '${DISCORD_WEBHOOK_URL}') {
      console.warn('[NotificationIntegration] Discord webhook URL not configured');
      return;
    }

    const { title, message, type, priority } = notification;
    const color = this.getDiscordColor(type, priority);
    const emoji = this.getDiscordEmoji(type, priority);

    const payload = {
      content: `${emoji} **${title}**`,
      embeds: [
        {
          title: title,
          description: message,
          color: color,
          fields: [
            {
              name: "Priority",
              value: priority.toUpperCase(),
              inline: true
            },
            {
              name: "Type", 
              value: type.toUpperCase(),
              inline: true
            }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    };

    this.queueWebhook('discord', webhookUrl, payload);
  }

  async sendTeamsWebhook(notification) {
    const webhookUrl = this.config.notification_preferences.channels.webhook?.endpoints?.teams?.url;
    if (!webhookUrl || webhookUrl === '${TEAMS_WEBHOOK_URL}') {
      console.warn('[NotificationIntegration] Teams webhook URL not configured');
      return;
    }

    const { title, message, type, priority } = notification;
    const color = this.getTeamsColor(type, priority);

    const payload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": color,
      "summary": title,
      "sections": [
        {
          "activityTitle": title,
          "activitySubtitle": `Priority: ${priority.toUpperCase()} | Type: ${type.toUpperCase()}`,
          "text": message,
          "facts": [
            {
              "name": "Priority",
              "value": priority.toUpperCase()
            },
            {
              "name": "Type",
              "value": type.toUpperCase()
            },
            {
              "name": "Timestamp",
              "value": new Date().toLocaleString()
            }
          ]
        }
      ]
    };

    this.queueWebhook('teams', webhookUrl, payload);
  }

  queueWebhook(service, url, payload) {
    this.webhookQueue.push({ service, url, payload, timestamp: Date.now() });
  }

  async startQueueProcessor() {
    setInterval(async () => {
      if (!this.isProcessingQueue && this.webhookQueue.length > 0) {
        this.isProcessingQueue = true;
        await this.processWebhookQueue();
        this.isProcessingQueue = false;
      }
    }, 1000); // Process queue every second
  }

  async processWebhookQueue() {
    while (this.webhookQueue.length > 0) {
      const webhookItem = this.webhookQueue.shift();
      try {
        await axios.post(webhookItem.url, webhookItem.payload, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Cartrita-Notification-Service/2.0'
          }
        });
        console.log(`[NotificationIntegration] Successfully sent ${webhookItem.service} webhook`);
      } catch (error) {
        console.error(`[NotificationIntegration] Failed to send ${webhookItem.service} webhook:`, error.message);
        
        // Retry logic: put back in queue if not too old (5 minutes)
        const age = Date.now() - webhookItem.timestamp;
        if (age < 300000) { // 5 minutes
          this.webhookQueue.push(webhookItem);
        }
      }
      
      // Rate limiting: small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  getSlackColor(type, priority) {
    if (priority === 'critical') return '#ff0000';
    if (priority === 'high') return '#ff9900';
    if (type === 'error') return '#ff0000';
    if (type === 'warning') return '#ffcc00';
    if (type === 'success') return '#00ff00';
    return '#0099ff';
  }

  getSlackEmoji(type, priority) {
    if (priority === 'critical') return '🚨';
    if (priority === 'high') return '⚠️';
    if (type === 'error') return '❌';
    if (type === 'warning') return '⚠️';
    if (type === 'success') return '✅';
    return 'ℹ️';
  }

  getDiscordColor(type, priority) {
    if (priority === 'critical') return 16711680; // Red
    if (priority === 'high') return 16753920; // Orange
    if (type === 'error') return 16711680; // Red
    if (type === 'warning') return 16776960; // Yellow
    if (type === 'success') return 65280; // Green
    return 255; // Blue
  }

  getDiscordEmoji(type, priority) {
    if (priority === 'critical') return '🚨';
    if (priority === 'high') return '⚠️';
    if (type === 'error') return '❌';
    if (type === 'warning') return '⚠️';
    if (type === 'success') return '✅';
    return 'ℹ️';
  }

  getTeamsColor(type, priority) {
    if (priority === 'critical') return 'FF0000';
    if (priority === 'high') return 'FF9900';
    if (type === 'error') return 'FF0000';
    if (type === 'warning') return 'FFCC00';
    if (type === 'success') return '00FF00';
    return '0099FF';
  }

  // Health monitoring integration
  async checkSystemHealth() {
    if (!this.config?.monitoring_integrations?.health_checks?.enabled) {
      return;
    }

    const endpoints = this.config.monitoring_integrations.health_checks.endpoints || [];
    const results = [];

    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        const response = await axios.get(endpoint.url, { 
          timeout: endpoint.timeout || 5000 
        });
        const duration = Date.now() - start;

        const isHealthy = response.status === (endpoint.expected_status || 200);
        results.push({
          name: endpoint.name,
          healthy: isHealthy,
          response_time: duration,
          status: response.status
        });

        if (!isHealthy) {
          await this.sendNotification({
            title: `Health Check Failed: ${endpoint.name}`,
            message: `${endpoint.name} returned status ${response.status}, expected ${endpoint.expected_status || 200}`,
            type: 'error',
            category: 'system',
            priority: 'high',
            metadata: { endpoint: endpoint.name, status: response.status }
          });
        }

      } catch (error) {
        results.push({
          name: endpoint.name,
          healthy: false,
          error: error.message
        });

        await this.sendNotification({
          title: `Service Down: ${endpoint.name}`,
          message: `${endpoint.name} is not responding: ${error.message}`,
          type: 'error',
          category: 'system', 
          priority: 'critical',
          metadata: { endpoint: endpoint.name, error: error.message }
        });
      }
    }

    return results;
  }

  // Performance monitoring
  async checkPerformanceMetrics() {
    const metrics = await this.collectPerformanceMetrics();
    const thresholds = this.config?.monitoring_integrations?.performance_monitoring?.metrics || {};

    for (const [metricName, value] of Object.entries(metrics)) {
      const threshold = thresholds[metricName];
      if (!threshold) continue;

      if (value > threshold.critical_threshold) {
        await this.sendNotification({
          title: `Critical Performance Alert: ${metricName}`,
          message: `${metricName} is ${value}, exceeding critical threshold of ${threshold.critical_threshold}`,
          type: 'error',
          category: 'system',
          priority: 'critical',
          metadata: { metric: metricName, value, threshold: threshold.critical_threshold }
        });
      } else if (value > threshold.warning_threshold) {
        await this.sendNotification({
          title: `Performance Warning: ${metricName}`,
          message: `${metricName} is ${value}, exceeding warning threshold of ${threshold.warning_threshold}`,
          type: 'warning',
          category: 'system',
          priority: 'medium',
          metadata: { metric: metricName, value, threshold: threshold.warning_threshold }
        });
      }
    }
  }

  async collectPerformanceMetrics() {
    const metrics = {};
    
    try {
      // Collect memory usage
      const memUsage = process.memoryUsage();
      metrics.memory_usage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
      
      // Collect response time (mock for now)
      metrics.response_time = Math.random() * 1000; // Placeholder
      
      // Collect error rate (mock for now)
      metrics.error_rate = Math.random() * 5; // Placeholder
      
    } catch (error) {
      console.error('[NotificationIntegration] Error collecting metrics:', error.message);
    }
    
    return metrics;
  }

  // Start monitoring services
  start() {
    console.log('[NotificationIntegration] Starting monitoring services...');
    
    // Health check monitoring
    if (this.config?.monitoring_integrations?.health_checks?.enabled) {
      const interval = this.config.monitoring_integrations.health_checks.interval || 30000;
      setInterval(() => {
        this.checkSystemHealth().catch(console.error);
      }, interval);
      console.log(`[NotificationIntegration] Health checks enabled (${interval}ms interval)`);
    }

    // Performance monitoring
    if (this.config?.monitoring_integrations?.performance_monitoring?.enabled) {
      setInterval(() => {
        this.checkPerformanceMetrics().catch(console.error);
      }, 60000); // Check every minute
      console.log('[NotificationIntegration] Performance monitoring enabled');
    }
  }
}

module.exports = NotificationIntegrationService;
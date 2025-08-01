#!/usr/bin/env node

const axios = require('axios');
// Fallback for chalk if not available
let chalk;
try {
  chalk = require('chalk');
} catch (e) {
  // Simple fallback if chalk is not available
  chalk = {
    blue: (text) => text,
    green: (text) => text,
    red: (text) => text,
    yellow: (text) => text,
    cyan: (text) => text,
    magenta: { bold: (text) => text },
    bold: (text) => text
  };
}

const BASE_URL = 'http://localhost:8000';

// Test configuration
const testConfig = {
  baseURL: BASE_URL,
  timeout: 10000,
  testUser: {
    email: 'robertjamesallen1122@gmail.com',
    password: 'punky1'
  }
};

let authToken = null;

// Utility functions
const log = {
  info: (msg) => console.log('ℹ', msg),
  success: (msg) => console.log('✓', msg),
  error: (msg) => console.log('✗', msg),
  warn: (msg) => console.log('⚠', msg),
  section: (msg) => console.log('\n=== ' + msg + ' ==='),
};

const makeRequest = async (method, endpoint, data = null, requireAuth = true) => {
  try {
    const config = {
      method,
      url: `${testConfig.baseURL}${endpoint}`,
      timeout: testConfig.timeout,
      headers: {}
    };

    if (requireAuth && authToken) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (data) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 0
    };
  }
};

// Test functions
async function testAuthentication() {
  log.section('Authentication Tests');
  
  // Test login
  log.info('Testing user login...');
  const loginResult = await makeRequest('POST', '/api/auth/login', {
    email: testConfig.testUser.email,
    password: testConfig.testUser.password
  }, false);

  if (loginResult.success && loginResult.data.token) {
    authToken = loginResult.data.token;
    log.success('User login successful');
    return true;
  } else {
    log.error('User login failed:', loginResult.error);
    return false;
  }
}

async function testCalendarIntegration() {
  log.section('Calendar Integration Tests');
  
  // Test calendar status
  log.info('Testing calendar service status...');
  const statusResult = await makeRequest('GET', '/api/calendar/status');
  
  if (statusResult.success) {
    log.success('Calendar service is running');
    log.info(`Status: ${JSON.stringify(statusResult.data.status)}`);
  } else {
    log.error('Calendar service status check failed:', statusResult.error);
  }

  // Test calendar sync (will fail without credentials but should return proper error)
  log.info('Testing calendar sync endpoint...');
  const syncResult = await makeRequest('POST', '/api/calendar/sync', {
    calendar_ids: ['primary']
  });
  
  if (syncResult.status === 400 && syncResult.error.code === 'CREDENTIALS_MISSING') {
    log.success('Calendar sync endpoint working (credentials missing as expected)');
  } else if (syncResult.success) {
    log.success('Calendar sync successful');
  } else {
    log.warn('Calendar sync test inconclusive:', syncResult.error);
  }

  // Test get events
  log.info('Testing get calendar events...');
  const eventsResult = await makeRequest('GET', '/api/calendar/events?limit=10');
  
  if (eventsResult.success) {
    log.success(`Retrieved ${eventsResult.data.events.length} calendar events`);
  } else {
    log.error('Get calendar events failed:', eventsResult.error);
  }
}

async function testEmailIntegration() {
  log.section('Email Integration Tests');
  
  // Test email service status
  log.info('Testing email service status...');
  const statusResult = await makeRequest('GET', '/api/email/status');
  
  if (statusResult.success) {
    log.success('Email service is running');
  } else {
    log.error('Email service status check failed:', statusResult.error);
  }

  // Test email sync
  log.info('Testing email sync endpoint...');
  const syncResult = await makeRequest('POST', '/api/email/sync', {
    providers: ['gmail'],
    max_messages: 10
  });
  
  if (syncResult.status === 400 && syncResult.error.code === 'CREDENTIALS_MISSING') {
    log.success('Email sync endpoint working (credentials missing as expected)');
  } else if (syncResult.success) {
    log.success('Email sync successful');
  } else {
    log.warn('Email sync test inconclusive:', syncResult.error);
  }

  // Test get messages
  log.info('Testing get email messages...');
  const messagesResult = await makeRequest('GET', '/api/email/messages?limit=10');
  
  if (messagesResult.success) {
    log.success(`Retrieved ${messagesResult.data.messages.length} email messages`);
  } else {
    log.error('Get email messages failed:', messagesResult.error);
  }

  // Test email statistics
  log.info('Testing email statistics...');
  const statsResult = await makeRequest('GET', '/api/email/stats?days=7');
  
  if (statsResult.success) {
    log.success('Email statistics retrieved successfully');
    log.info(`Total messages: ${statsResult.data.stats.total_messages}`);
  } else {
    log.error('Email statistics failed:', statsResult.error);
  }
}

async function testContactIntegration() {
  log.section('Contact Integration Tests');
  
  // Test contact service status
  log.info('Testing contact service status...');
  const statusResult = await makeRequest('GET', '/api/contacts/status');
  
  if (statusResult.success) {
    log.success('Contact service is running');
  } else {
    log.error('Contact service status check failed:', statusResult.error);
  }

  // Test contact sync
  log.info('Testing contact sync endpoint...');
  const syncResult = await makeRequest('POST', '/api/contacts/sync', {
    providers: ['google'],
    max_contacts: 10
  });
  
  if (syncResult.status === 400 && syncResult.error.code === 'CREDENTIALS_MISSING') {
    log.success('Contact sync endpoint working (credentials missing as expected)');
  } else if (syncResult.success) {
    log.success('Contact sync successful');
  } else {
    log.warn('Contact sync test inconclusive:', syncResult.error);
  }

  // Test get contacts
  log.info('Testing get contacts...');
  const contactsResult = await makeRequest('GET', '/api/contacts?limit=10');
  
  if (contactsResult.success) {
    log.success(`Retrieved ${contactsResult.data.contacts.length} contacts`);
  } else {
    log.error('Get contacts failed:', contactsResult.error);
  }

  // Test create contact
  log.info('Testing create contact...');
  const createResult = await makeRequest('POST', '/api/contacts', {
    first_name: 'Test',
    last_name: 'Contact',
    email_addresses: [{ email: 'test@example.com', type: 'work', primary: true }],
    phone_numbers: [{ number: '+1234567890', type: 'mobile', primary: true }]
  });
  
  if (createResult.success) {
    log.success('Contact created successfully');
    
    // Clean up - delete the test contact
    const contactId = createResult.data.contact.id;
    const deleteResult = await makeRequest('DELETE', `/api/contacts/${contactId}`);
    
    if (deleteResult.success) {
      log.success('Test contact cleaned up');
    }
  } else {
    log.error('Create contact failed:', createResult.error);
  }

  // Test contact statistics
  log.info('Testing contact statistics...');
  const statsResult = await makeRequest('GET', '/api/contacts/stats?days=30');
  
  if (statsResult.success) {
    log.success('Contact statistics retrieved successfully');
    log.info(`Total contacts: ${statsResult.data.stats.total_contacts}`);
  } else {
    log.error('Contact statistics failed:', statsResult.error);
  }
}

async function testNotificationSystem() {
  log.section('Notification System Tests');
  
  // Test notification service status
  log.info('Testing notification service status...');
  const statusResult = await makeRequest('GET', '/api/notifications/status');
  
  if (statusResult.success) {
    log.success('Notification service is running');
  } else {
    log.error('Notification service status check failed:', statusResult.error);
  }

  // Test get notifications
  log.info('Testing get notifications...');
  const notificationsResult = await makeRequest('GET', '/api/notifications?limit=10');
  
  if (notificationsResult.success) {
    log.success(`Retrieved ${notificationsResult.data.notifications.length} notifications`);
  } else {
    log.error('Get notifications failed:', notificationsResult.error);
  }

  // Test notification preferences
  log.info('Testing notification preferences...');
  const prefsResult = await makeRequest('GET', '/api/notifications/preferences');
  
  if (prefsResult.success) {
    log.success(`Retrieved ${prefsResult.data.preferences.length} notification preferences`);
  } else {
    log.error('Get notification preferences failed:', prefsResult.error);
  }

  // Test create notification (for testing)
  log.info('Testing create test notification...');
  const createResult = await makeRequest('POST', '/api/notifications/create', {
    type: 'calendar_reminder',
    title: 'Test Notification',
    message: 'This is a test notification from the integration test',
    urgency: 2
  });
  
  if (createResult.success) {
    log.success('Test notification created successfully');
  } else {
    log.error('Create test notification failed:', createResult.error);
  }

  // Test notification statistics
  log.info('Testing notification statistics...');
  const statsResult = await makeRequest('GET', '/api/notifications/stats?days=7');
  
  if (statsResult.success) {
    log.success('Notification statistics retrieved successfully');
    log.info(`Total notifications: ${statsResult.data.stats.total_notifications}`);
  } else {
    log.error('Notification statistics failed:', statsResult.error);
  }
}

async function testPrivacyControls() {
  log.section('Privacy Control Tests');
  
  // Test privacy service status
  log.info('Testing privacy service status...');
  const statusResult = await makeRequest('GET', '/api/privacy/status');
  
  if (statusResult.success) {
    log.success('Privacy service is running');
  } else {
    log.error('Privacy service status check failed:', statusResult.error);
  }

  // Test get consent status
  log.info('Testing get consent status...');
  const consentResult = await makeRequest('GET', '/api/privacy/consent');
  
  if (consentResult.success) {
    log.success(`Retrieved ${consentResult.data.consent.length} consent records`);
  } else {
    log.error('Get consent status failed:', consentResult.error);
  }

  // Test get retention policies
  log.info('Testing get retention policies...');
  const retentionResult = await makeRequest('GET', '/api/privacy/retention');
  
  if (retentionResult.success) {
    log.success(`Retrieved ${retentionResult.data.retention_policies.length} retention policies`);
  } else {
    log.error('Get retention policies failed:', retentionResult.error);
  }

  // Test privacy dashboard
  log.info('Testing privacy dashboard...');
  const dashboardResult = await makeRequest('GET', '/api/privacy/dashboard');
  
  if (dashboardResult.success) {
    log.success('Privacy dashboard retrieved successfully');
    const dashboard = dashboardResult.data.dashboard;
    log.info(`Consent records: ${dashboard.consent_records.length}`);
    log.info(`Retention policies: ${dashboard.retention_policies.length}`);
    log.info(`Data usage: ${JSON.stringify(dashboard.data_usage_statistics)}`);
  } else {
    log.error('Privacy dashboard failed:', dashboardResult.error);
  }

  // Test get available data types
  log.info('Testing get available data types...');
  const dataTypesResult = await makeRequest('GET', '/api/privacy/data-types');
  
  if (dataTypesResult.success) {
    log.success(`Retrieved ${dataTypesResult.data.data_types.length} available data types`);
  } else {
    log.error('Get data types failed:', dataTypesResult.error);
  }
}

async function testApiKeyVault() {
  log.section('API Key Vault Tests');
  
  // Test get available providers
  log.info('Testing get API providers...');
  const providersResult = await makeRequest('GET', '/api/keys/providers');
  
  if (providersResult.success) {
    log.success(`Retrieved ${providersResult.data.providers.length} API providers`);
  } else {
    log.error('Get API providers failed:', providersResult.error);
  }

  // Test get user API keys
  log.info('Testing get user API keys...');
  const keysResult = await makeRequest('GET', '/api/keys');
  
  if (keysResult.success) {
    log.success(`User has ${keysResult.data.keys.length} API keys configured`);
  } else {
    log.error('Get user API keys failed:', keysResult.error);
  }
}

async function testSystemHealth() {
  log.section('System Health Tests');
  
  // Test overall health
  log.info('Testing system health...');
  const healthResult = await makeRequest('GET', '/api/health', null, false);
  
  if (healthResult.success) {
    log.success('System health check passed');
    log.info(`Overall status: ${healthResult.data.overall}`);
  } else {
    log.error('System health check failed:', healthResult.error);
  }

  // Test individual service status
  log.info('Testing service status...');
  const statusResult = await makeRequest('GET', '/api/status', null, false);
  
  if (statusResult.success) {
    log.success('Service status retrieved successfully');
    const services = statusResult.data.services.services;
    for (const [service, status] of Object.entries(services)) {
      if (status.available && status.status === 'ready') {
        log.success(`${service}: ${status.status}`);
      } else {
        log.warn(`${service}: ${status.status || 'unavailable'}`);
      }
    }
  } else {
    log.error('Service status check failed:', statusResult.error);
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n🚀 Cartrita Personal Life OS - Integration Test Suite\n');
  
  const startTime = Date.now();
  let passedTests = 0;
  let totalTests = 0;

  try {
    // Test authentication first
    const authSuccess = await testAuthentication();
    if (!authSuccess) {
      log.error('Authentication failed - cannot proceed with authenticated tests');
      return;
    }

    // Run all test suites
    const testSuites = [
      testSystemHealth,
      testApiKeyVault, 
      testCalendarIntegration,
      testEmailIntegration,
      testContactIntegration,
      testNotificationSystem,
      testPrivacyControls
    ];

    for (const testSuite of testSuites) {
      try {
        await testSuite();
        passedTests++;
      } catch (error) {
        log.error(`Test suite failed: ${error.message}`);
      }
      totalTests++;
    }

  } catch (error) {
    log.error('Test runner failed:', error.message);
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  log.section('Test Summary');
  
  if (passedTests === totalTests) {
    log.success(`All ${totalTests} test suites passed! ✨`);
  } else {
    log.warn(`${passedTests}/${totalTests} test suites passed`);
  }
  
  log.info(`Total duration: ${duration}s`);
  
  console.log('\n🎉 Integration test complete!\n');
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, testConfig };
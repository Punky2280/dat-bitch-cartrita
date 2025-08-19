/**
 * Settings Routes - User settings management
 */

import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';

const router = express.Router();

// Mock user settings storage (in a real app, this would be in a database)
const userSettings = {
  theme: 'dark',
  language: 'en',
  notifications: 'all',
  soundEnabled: true,
  autoSave: true,
  apiKeys: {},
  displayName: 'User',
  email: 'user@example.com',
  timezone: 'UTC',
  enable2FA: false,
  sessionTimeout: '1h',
  dataEncryption: true,
  emailNotifications: true,
  pushNotifications: true,
  soundNotifications: true,
  agentUpdates: true,
  systemAlerts: true,
  accentColor: 'cyan',
  animations: true,
  autoSaveInterval: '5m',
  enableTelemetry: true,
  enableCaching: true,
  enableCompression: true,
  enableBackups: true
};

// Get user settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('[Settings] Getting user settings');
    res.json(userSettings);
  } catch (error) {
    console.error('[Settings] Failed to get settings:', error);
    res.status(500).json({
      error: 'Failed to get settings',
      message: error.message
    });
  }
});

// Update user settings
router.put('/', authenticateToken, async (req, res) => {
  try {
    console.log('[Settings] Updating user settings:', req.body);
    
    // Merge updated settings
    Object.assign(userSettings, req.body);
    
    res.json(userSettings);
  } catch (error) {
    console.error('[Settings] Failed to update settings:', error);
    res.status(500).json({
      error: 'Failed to update settings',
      message: error.message
    });
  }
});

export default router;
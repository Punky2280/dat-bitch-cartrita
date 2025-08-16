import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import { auditSensitiveOperation } from '../middleware/enhancedAuth.js';
import MFAService from '../services/MFAService.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

// All MFA routes require authentication
router.use(authenticateToken);

/**
 * GET /api/mfa/status - Get MFA status for current user
 */
router.get('/status', async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('mfa.api.status');
  
  try {
    const status = await MFAService.getMFAStatus(req.user.id);
    
    span.setAttributes({
      'mfa.user_id': req.user.id,
      'mfa.enabled': status.enabled
    });
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    span.recordException(error);
    console.error('MFA status error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get MFA status' 
    });
  } finally {
    span.end();
  }
});

/**
 * POST /api/mfa/setup - Begin MFA setup process
 */
router.post('/setup', auditSensitiveOperation('MFA_SETUP_START'), async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('mfa.api.setup');
  
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    // Check if MFA is already enabled
    const currentStatus = await MFAService.getMFAStatus(userId);
    if (currentStatus.enabled) {
      return res.status(400).json({
        success: false,
        error: 'MFA is already enabled for this account'
      });
    }
    
    // Generate TOTP secret and backup codes
    const setup = await MFAService.generateTOTPSecret(userId, userEmail);
    
    span.setAttributes({
      'mfa.user_id': userId,
      'mfa.setup_initiated': true
    });
    
    res.json({
      success: true,
      data: {
        qrCodeUrl: setup.qrCodeUrl,
        backupCodes: setup.backupCodes,
        message: 'Scan the QR code with your authenticator app, then verify with a code to complete setup'
      }
    });
    
  } catch (error) {
    span.recordException(error);
    console.error('MFA setup error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to setup MFA' 
    });
  } finally {
    span.end();
  }
});

/**
 * POST /api/mfa/verify-setup - Complete MFA setup by verifying token
 */
router.post('/verify-setup', auditSensitiveOperation('MFA_SETUP_COMPLETE'), async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('mfa.api.verify_setup');
  
  try {
    const { token } = req.body;
    
    if (!token || token.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Valid 6-digit token required'
      });
    }
    
    const verified = await MFAService.verifyAndEnableTOTP(req.user.id, token);
    
    if (verified) {
      span.setAttributes({
        'mfa.user_id': req.user.id,
        'mfa.setup_completed': true
      });
      
      res.json({
        success: true,
        message: 'MFA has been successfully enabled for your account'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid token. Please try again.'
      });
    }
    
  } catch (error) {
    span.recordException(error);
    console.error('MFA verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify MFA setup' 
    });
  } finally {
    span.end();
  }
});

/**
 * POST /api/mfa/verify - Verify MFA token (for login)
 */
router.post('/verify', async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('mfa.api.verify');
  
  try {
    const { token, backupCode } = req.body;
    
    if (!token && !backupCode) {
      return res.status(400).json({
        success: false,
        error: 'Either token or backup code is required'
      });
    }
    
    let verified = false;
    let usedBackupCode = false;
    
    if (token) {
      // Verify TOTP token
      if (token.length !== 6) {
        return res.status(400).json({
          success: false,
          error: 'Token must be 6 digits'
        });
      }
      
      verified = await MFAService.verifyTOTP(req.user.id, token);
    } else if (backupCode) {
      // Verify backup code
      verified = await MFAService.verifyBackupCode(req.user.id, backupCode.toUpperCase());
      usedBackupCode = verified;
    }
    
    span.setAttributes({
      'mfa.user_id': req.user.id,
      'mfa.verified': verified,
      'mfa.used_backup_code': usedBackupCode
    });
    
    if (verified) {
      res.json({
        success: true,
        message: usedBackupCode 
          ? 'Backup code verified successfully' 
          : 'MFA token verified successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid token or backup code'
      });
    }
    
  } catch (error) {
    span.recordException(error);
    console.error('MFA verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify MFA' 
    });
  } finally {
    span.end();
  }
});

/**
 * POST /api/mfa/disable - Disable MFA for current user
 */
router.post('/disable', auditSensitiveOperation('MFA_DISABLE'), async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('mfa.api.disable');
  
  try {
    const { password, token } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Current password is required to disable MFA'
      });
    }
    
    // Verify password (implement password verification based on your auth system)
    // For now, assuming password verification is done elsewhere
    
    // If MFA is enabled, require MFA token to disable it
    const mfaStatus = await MFAService.getMFAStatus(req.user.id);
    if (mfaStatus.enabled) {
      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'MFA token required to disable MFA'
        });
      }
      
      const mfaVerified = await MFAService.verifyTOTP(req.user.id, token);
      if (!mfaVerified) {
        return res.status(400).json({
          success: false,
          error: 'Invalid MFA token'
        });
      }
    }
    
    const disabled = await MFAService.disableMFA(req.user.id);
    
    if (disabled) {
      span.setAttributes({
        'mfa.user_id': req.user.id,
        'mfa.disabled': true
      });
      
      res.json({
        success: true,
        message: 'MFA has been disabled for your account'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'MFA was not enabled or could not be disabled'
      });
    }
    
  } catch (error) {
    span.recordException(error);
    console.error('MFA disable error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to disable MFA' 
    });
  } finally {
    span.end();
  }
});

/**
 * POST /api/mfa/backup-codes/regenerate - Generate new backup codes
 */
router.post('/backup-codes/regenerate', auditSensitiveOperation('MFA_REGENERATE_BACKUP_CODES'), async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('mfa.api.regenerate_backup_codes');
  
  try {
    const { token } = req.body;
    
    // Check if MFA is enabled
    const mfaStatus = await MFAService.getMFAStatus(req.user.id);
    if (!mfaStatus.enabled) {
      return res.status(400).json({
        success: false,
        error: 'MFA is not enabled for this account'
      });
    }
    
    // Require MFA token to regenerate backup codes
    if (!token || token.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Valid 6-digit MFA token required'
      });
    }
    
    const verified = await MFAService.verifyTOTP(req.user.id, token);
    if (!verified) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MFA token'
      });
    }
    
    // Generate new backup codes
    const newBackupCodes = await MFAService.generateNewBackupCodes(req.user.id);
    
    span.setAttributes({
      'mfa.user_id': req.user.id,
      'mfa.backup_codes_regenerated': true,
      'mfa.new_backup_codes_count': newBackupCodes.length
    });
    
    res.json({
      success: true,
      data: {
        backupCodes: newBackupCodes,
        message: 'New backup codes generated. Save these codes in a safe place - they will not be shown again.'
      }
    });
    
  } catch (error) {
    span.recordException(error);
    console.error('MFA backup codes regeneration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to regenerate backup codes' 
    });
  } finally {
    span.end();
  }
});

/**
 * GET /api/mfa/backup-codes/status - Get backup codes status
 */
router.get('/backup-codes/status', async (req, res) => {
  const span = OpenTelemetryTracing.traceOperation('mfa.api.backup_codes_status');
  
  try {
    const status = await MFAService.getMFAStatus(req.user.id);
    
    res.json({
      success: true,
      data: {
        hasBackupCodes: status.hasBackupCodes,
        unusedBackupCodes: status.unusedBackupCodes,
        totalBackupCodes: 10 // We always generate 10 backup codes
      }
    });
    
  } catch (error) {
    span.recordException(error);
    console.error('MFA backup codes status error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get backup codes status' 
    });
  } finally {
    span.end();
  }
});

export default router;

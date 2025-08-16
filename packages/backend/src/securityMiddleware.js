/**
 * Security Middleware - Task 18: Security Framework Implementation
 * Provides authentication, JWT validation, RBAC, and audit logging
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import OpenTelemetryTracing from './system/OpenTelemetryTracing.js';

// RBAC roles and permissions
const ROLES = {
    admin: ['read', 'write', 'delete', 'manage'],
    editor: ['read', 'write'],
    viewer: ['read'],
    auditor: ['read', 'audit'],
};

// JWT secret (should be loaded from env/secure vault)
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Middleware: Authenticate JWT and attach user to request
function authenticateJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
}

// Middleware: Role-based access control
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ success: false, error: 'No user role found' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Insufficient role permissions' });
        }
        next();
    };
}

// Middleware: Permission-based access control
function authorizePermissions(...requiredPermissions) {
    return (req, res, next) => {
        const role = req.user?.role;
        const permissions = ROLES[role] || [];
        const hasAll = requiredPermissions.every(p => permissions.includes(p));
        if (!hasAll) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }
        next();
    };
}

// Utility: Generate JWT token
function generateJWT(user) {
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        issuedAt: Date.now(),
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
}

// Utility: Encrypt data
function encryptData(data, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

// Utility: Decrypt data
function decryptData(encrypted, key) {
    const [ivHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Audit logging
function auditLog(event, user, details = {}) {
    OpenTelemetryTracing.traceOperation('security.audit_log', () => {
        // TODO: Persist audit log to DB
        console.log(`[AUDIT] ${new Date().toISOString()} | user=${user?.id || 'unknown'} | event=${event} | details=${JSON.stringify(details)}`);
    });
}

export {
    authenticateJWT,
    authorizeRoles,
    authorizePermissions,
    generateJWT,
    encryptData,
    decryptData,
    auditLog,
    ROLES,
};

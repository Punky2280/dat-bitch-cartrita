/**
 * @fileoverview MCP Security Manager
 * Handles authentication, authorization, and security policies
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { trace, SpanKind } from '@opentelemetry/api';
import { Logger } from '../core/index.js';

export interface JWTConfig {
  secret: string;
  expiry: string;
}

export interface UserPayload {
  id: string;
  email: string;
  name?: string;
  role?: string;
  permissions?: string[];
}

export interface SecurityContext {
  user: UserPayload;
  permissions: string[];
  budget?: {
    maxUsd: number;
    usedUsd: number;
  };
  rateLimit?: {
    remaining: number;
    resetTime: number;
  };
}

/**
 * Security Manager for MCP authentication and authorization
 */
export class MCPSecurityManager {
  private readonly logger: Logger;
  private readonly jwtConfig: JWTConfig;
  private readonly tracer = trace.getTracer('mcp-security');
  
  // In-memory session store (use Redis in production)
  private readonly activeSessions = new Map<string, {
    userId: string;
    createdAt: Date;
    lastActivity: Date;
    ipAddress?: string;
  }>();

  constructor(jwtConfig: JWTConfig) {
    this.logger = Logger.create('MCPSecurityManager');
    this.jwtConfig = jwtConfig;
    
    // Clean up expired sessions periodically
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Every minute
    
    this.logger.info('Security Manager initialized');
  }

  /**
   * Generate JWT token for user
   */
  async generateToken(user: UserPayload): Promise<string> {
    const span = this.tracer.startSpan('mcp.security.generate_token', {
      attributes: {
        'user.id': user.id,
        'user.email': user.email,
      },
    });

    try {
      const payload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        permissions: user.permissions || [],
        iat: Math.floor(Date.now() / 1000),
      };

      const token = jwt.sign(payload, this.jwtConfig.secret, {
        expiresIn: this.jwtConfig.expiry,
        issuer: 'cartrita-mcp',
        audience: 'cartrita-users',
      });

      // Store session
      const sessionId = randomBytes(32).toString('hex');
      this.activeSessions.set(sessionId, {
        userId: user.id,
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      span.setAttributes({ 'token.generated': true });
      this.logger.info('Token generated', { userId: user.id });
      
      return token;
    } catch (error) {
      span.recordException(error as Error);
      this.logger.error('Token generation failed', error as Error, { userId: user.id });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<UserPayload> {
    const span = this.tracer.startSpan('mcp.security.verify_token');

    try {
      const decoded = jwt.verify(token, this.jwtConfig.secret, {
        issuer: 'cartrita-mcp',
        audience: 'cartrita-users',
      }) as any;

      const user: UserPayload = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        permissions: decoded.permissions || [],
      };

      span.setAttributes({ 
        'token.valid': true,
        'user.id': user.id 
      });
      
      return user;
    } catch (error) {
      span.recordException(error as Error);
      
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    } finally {
      span.end();
    }
  }

  /**
   * Authenticate request (Fastify preHandler)
   */
  async authenticate(request: any, reply: any): Promise<void> {
    const span = this.tracer.startSpan('mcp.security.authenticate', {
      kind: SpanKind.SERVER,
    });

    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      const user = await this.verifyToken(token);
      
      // Create security context
      const securityContext = await this.createSecurityContext(user, request);
      
      // Attach to request
      request.user = user;
      request.security = securityContext;
      
      span.setAttributes({ 
        'auth.success': true,
        'user.id': user.id 
      });
    } catch (error) {
      span.recordException(error as Error);
      this.logger.warn('Authentication failed', error as Error, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      
      reply.status(401).send({
        error: 'Authentication failed',
        message: (error as Error).message,
      });
    } finally {
      span.end();
    }
  }

  /**
   * Check if user has required permission
   */
  hasPermission(user: UserPayload, permission: string): boolean {
    if (!user.permissions) {
      return false;
    }

    // Check exact permission
    if (user.permissions.includes(permission)) {
      return true;
    }

    // Check wildcard permissions
    const wildcardPermission = permission.split('.').slice(0, -1).join('.') + '.*';
    if (user.permissions.includes(wildcardPermission)) {
      return true;
    }

    // Admin role has all permissions
    if (user.role === 'admin') {
      return true;
    }

    return false;
  }

  /**
   * Authorize request for specific permission
   */
  async authorize(permission: string) {
    return async (request: any, reply: any) => {
      const span = this.tracer.startSpan('mcp.security.authorize', {
        attributes: {
          'auth.permission': permission,
          'user.id': request.user?.id,
        },
      });

      try {
        if (!request.user) {
          throw new Error('User not authenticated');
        }

        if (!this.hasPermission(request.user, permission)) {
          throw new Error(`Insufficient permissions: ${permission}`);
        }

        span.setAttributes({ 'auth.authorized': true });
      } catch (error) {
        span.recordException(error as Error);
        this.logger.warn('Authorization failed', error as Error, {
          userId: request.user?.id,
          permission,
        });

        reply.status(403).send({
          error: 'Authorization failed',
          message: (error as Error).message,
        });
      } finally {
        span.end();
      }
    };
  }

  /**
   * Hash password for storage
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate secure API key
   */
  generateApiKey(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Validate API key format
   */
  isValidApiKey(key: string): boolean {
    return /^[A-Za-z0-9_-]{43}$/.test(key);
  }

  /**
   * Get security statistics
   */
  getStats() {
    return {
      activeSessions: this.activeSessions.size,
      sessionDetails: Array.from(this.activeSessions.entries()).map(([id, session]) => ({
        id: id.substring(0, 8) + '...',
        userId: session.userId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        duration: Date.now() - session.createdAt.getTime(),
      })),
    };
  }

  /**
   * Revoke user sessions
   */
  revokeUserSessions(userId: string): number {
    const span = this.tracer.startSpan('mcp.security.revoke_sessions', {
      attributes: { 'user.id': userId },
    });

    try {
      let revokedCount = 0;
      
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (session.userId === userId) {
          this.activeSessions.delete(sessionId);
          revokedCount++;
        }
      }

      span.setAttributes({ 'sessions.revoked': revokedCount });
      this.logger.info('User sessions revoked', { userId, count: revokedCount });
      
      return revokedCount;
    } finally {
      span.end();
    }
  }

  private async createSecurityContext(user: UserPayload, request: any): Promise<SecurityContext> {
    // This would typically fetch additional data from database
    return {
      user,
      permissions: user.permissions || [],
      budget: {
        maxUsd: 100.0, // Default budget
        usedUsd: 0.0,
      },
      rateLimit: {
        remaining: 100, // Requests remaining
        resetTime: Date.now() + 3600000, // 1 hour
      },
    };
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > maxAge) {
        this.activeSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug('Cleaned up expired sessions', { count: cleanedCount });
    }
  }
}
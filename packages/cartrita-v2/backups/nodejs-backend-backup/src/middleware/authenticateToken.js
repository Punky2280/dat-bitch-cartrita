/* global process, console */
import jwt from 'jsonwebtoken';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.warn(
      '[Auth Middleware] 🚫 No token found in Authorization header.'
    );
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }

  // Lightweight test bypass: allow a fixed token to short‑circuit JWT verify
  // This keeps integration tests fast & infra‑independent while still exercising route logic.
  if (process.env.LIGHTWEIGHT_TEST === '1') {
    if (token === 'test-admin-token') {
      req.user = {
        id: 'test-admin',
        name: 'Test Admin',
        email: 'test-admin@example.com',
        role: 'admin',
        is_admin: true,
      };
      return next();
    }
    if (token === 'test-user-token') {
      req.user = {
        id: 'test-user',
        name: 'Test User',
        email: 'test-user@example.com',
        role: 'user',
        is_admin: false,
      };
      return next();
    }
    // Fall through to normal verification for any other token to catch mistakes.
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decodedPayload) => {
    if (err) {
      const category =
        err.name === 'TokenExpiredError'
          ? 'expired'
          : err.name === 'JsonWebTokenError'
            ? 'malformed'
            : 'unknown';
      console.error(
        '[Auth Middleware] ❌ JWT Verification Error:',
        category,
        err.message
      );
      return res.status(403).json({
        error: 'Forbidden: Invalid or expired token.',
        category,
      });
    }

    // --- FIX: Create a consistent user object ---
    // The decoded payload has { sub, email, name }. We map 'sub' to 'id'.
    req.user = {
      id: decodedPayload.sub,
      name: decodedPayload.name,
      email: decodedPayload.email,
      role: decodedPayload.role || 'user',
      iss: decodedPayload.iss,
      aud: decodedPayload.aud,
      is_admin: decodedPayload.is_admin === true,
    };

    console.log('[Auth Middleware] ✅ Authenticated user:', req.user.id);
    console.log(
      '[Auth Middleware] 🔍 Full user object:',
      JSON.stringify(req.user)
    );
    next();
  });
}

export default authenticateToken;

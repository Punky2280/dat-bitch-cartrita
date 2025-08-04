/* global process, console */
import jwt from 'jsonwebtoken';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.warn('[Auth Middleware] 🚫 No token found in Authorization header.');
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decodedPayload) => {
    if (err) {
      console.error('[Auth Middleware] ❌ JWT Verification Error:', err);
      return res.status(403).json({ error: 'Forbidden: Invalid token.' });
    }

    // --- FIX: Create a consistent user object ---
    // The decoded payload has { sub, email, name }. We map 'sub' to 'id'.
    req.user = {
      id: decodedPayload.sub,
      name: decodedPayload.name,
      email: decodedPayload.email
    };

    console.log('[Auth Middleware] ✅ Authenticated user:', req.user.id);
    console.log('[Auth Middleware] 🔍 Full user object:', JSON.stringify(req.user));
    next();
  });
}

export default authenticateToken;

const jwt = require('jsonwebtoken');

function authenticateTokenSocket(socket, next) {
  const token = socket.handshake?.auth?.token;

  if (!token) {
    console.warn('[Socket Auth] 🚫 No token found in handshake.');
    return next(new Error('Authentication error: No token provided.'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decodedPayload) => {
    if (err) {
      console.error('[Socket Auth] ❌ Invalid token:', err.message);
      return next(new Error('Authentication error: Invalid token.'));
    }

    // Create consistent user object structure matching the HTTP middleware
    socket.user = {
      id: decodedPayload.sub,
      name: decodedPayload.name,
      email: decodedPayload.email,
    };
    
    console.log('[Socket Auth] ✅ Socket authenticated as:', socket.user.id);
    next();
  });
}

module.exports = authenticateTokenSocket;

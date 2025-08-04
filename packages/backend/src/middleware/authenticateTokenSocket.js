/* global process, console */
import jwt from 'jsonwebtoken';

function authenticateTokenSocket(socket, next) {
  const token = socket.handshake.query.token || socket.handshake.auth.token;

  if (!token) {
    console.warn('[Socket Auth] 🚫 No token found in handshake.');
    return next(new Error('Authentication error: No token provided.'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decodedPayload) => {
    if (err) {
      console.error('[Socket Auth] ❌ Invalid token:', err.message);
      return next(new Error('Authentication error: Invalid token.'));
    }

    console.log(`[Socket Auth] ✅ User authenticated: ${decodedPayload.username} (ID: ${decodedPayload.user_id})`);
    socket.userId = decodedPayload.user_id;
    socket.username = decodedPayload.username;
    socket.authenticated = true;
    next();
  });
}

export default authenticateTokenSocket;
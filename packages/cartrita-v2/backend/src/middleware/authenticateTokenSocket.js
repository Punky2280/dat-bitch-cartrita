/* global process, console */
import jwt from 'jsonwebtoken';

function authenticateTokenSocket(socket, next) {
  const token = socket.handshake.query.token || socket.handshake.auth.token;
  console.log('[Socket Auth] 🔍 Handshake query:', socket.handshake.query);
  console.log('[Socket Auth] 🔍 Handshake auth:', socket.handshake.auth);
  console.log('[Socket Auth] 🔍 Token found:', token ? 'YES' : 'NO');

  if (!token) {
    console.warn(
      '[Socket Auth] 🚫 No token found in handshake. Allowing connection without authentication.'
    );
    socket.userId = null;
    socket.username = 'anonymous';
    socket.authenticated = false;
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decodedPayload) => {
    if (err) {
      console.error('[Socket Auth] ❌ Invalid token:', err.message);
      return next(new Error('Authentication error: Invalid token.'));
    }

    console.log(
      '[Socket Auth] 🔍 Decoded payload:',
      JSON.stringify(decodedPayload, null, 2)
    );
    console.log(
      `[Socket Auth] ✅ User authenticated: ${decodedPayload.name} (ID: ${decodedPayload.sub})`
    );
    socket.userId = decodedPayload.sub;
    socket.username = decodedPayload.name;
    socket.authenticated = true;
    next();
  });
}

export default authenticateTokenSocket;

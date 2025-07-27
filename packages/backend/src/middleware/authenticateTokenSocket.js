// packages/backend/src/middleware/authenticateTokenSocket.js
const jwt = require('jsonwebtoken');

/**
 * Socket.IO middleware to authenticate a user via JWT.
 * The token is expected to be in the `auth.token` property of the socket handshake.
 */
function authenticateTokenSocket(socket, next) {
  const token = socket.handshake.auth.token;

  if (token == null) {
    console.error('[Socket Auth] Error: No token provided.');
    return next(new Error('Authentication error: No token provided.'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('[Socket Auth] Error: Invalid token.');
      return next(new Error('Authentication error: Invalid token.'));
    }
    // Attach the user payload to the socket object for use in event handlers
    socket.user = user;
    next();
  });
}

module.exports = authenticateTokenSocket;

const jwt = require('jsonwebtoken');
function authenticateTokenSocket(socket, next) {
  const token = socket.handshake.auth.token;
  if (token == null)
    return next(new Error('Authentication error: No token provided.'));
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Authentication error: Invalid token.'));
    socket.user = user;
    next();
  });
}
module.exports = authenticateTokenSocket;

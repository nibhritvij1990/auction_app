const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'someSecretKey';

function authMiddleware(req, res, next) {
  // Typically we look for a header: Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1]; // e.g. "Bearer <token>"
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  // Verify the token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    // Attach user info to request
    req.user = decoded; // e.g. { id: ..., role: ... }
    next();
  });
}

module.exports = authMiddleware;
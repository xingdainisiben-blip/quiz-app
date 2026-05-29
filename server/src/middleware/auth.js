const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'quiz-app-secret-key-change-in-production';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

function organizerOnly(req, res, next) {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Требуются права организатора' });
  }
  next();
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.split(' ')[1]);
    } catch (_) { /* ignore invalid token */ }
  }
  next();
}

module.exports = { generateToken, verifyToken, authMiddleware, organizerOnly, optionalAuth, JWT_SECRET };

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Имя пользователя: 3-30 символов'),
  body('email').trim().isEmail().withMessage('Некорректный email'),
  body('password').isLength({ min: 6 }).withMessage('Пароль: минимум 6 символов'),
  body('role').optional().isIn(['organizer', 'participant']).withMessage('Роль: organizer или participant'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, role = 'participant' } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email или именем уже существует' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(username, email, password_hash, role);

  const user = { id: result.lastInsertRowid, username, email, role };
  const token = generateToken(user);
  res.status(201).json({ token, user });
});

// POST /api/auth/login
router.post('/login', [
  body('email').trim().isEmail().withMessage('Некорректный email'),
  body('password').notEmpty().withMessage('Введите пароль'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

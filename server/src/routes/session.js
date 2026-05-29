const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authMiddleware, organizerOnly } = require('../middleware/auth');
const { generateRoomCode } = require('../utils/roomCode');

const router = express.Router();

// POST /api/sessions — create session (organizer starts a quiz)
router.post('/', authMiddleware, organizerOnly, [
  body('quiz_id').isInt().withMessage('quiz_id обязателен'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.body.quiz_id);

  if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
  if (quiz.organizer_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });

  // Check questions exist
  const questionCount = db.prepare('SELECT COUNT(*) as count FROM questions WHERE quiz_id = ?').get(quiz.id);
  if (questionCount.count === 0) {
    return res.status(400).json({ error: 'Добавьте хотя бы один вопрос перед запуском' });
  }

  // Generate unique room code
  let roomCode;
  let attempts = 0;
  do {
    roomCode = generateRoomCode();
    const existing = db.prepare('SELECT id FROM quiz_sessions WHERE room_code = ?').get(roomCode);
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    return res.status(500).json({ error: 'Не удалось создать комнату, попробуйте снова' });
  }

  // Update quiz status to ready
  db.prepare("UPDATE quizzes SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(quiz.id);

  const result = db.prepare(
    'INSERT INTO quiz_sessions (quiz_id, room_code) VALUES (?, ?)'
  ).run(quiz.id, roomCode);

  const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({ session });
});

// GET /api/sessions/:roomCode — get session info (for joining)
router.get('/:roomCode', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM quiz_sessions WHERE room_code = ?').get(req.params.roomCode);

  if (!session) return res.status(404).json({ error: 'Комната не найдена' });

  const quiz = db.prepare('SELECT id, title, description, category, time_per_question FROM quizzes WHERE id = ?')
    .get(session.quiz_id);
  const participantCount = db.prepare('SELECT COUNT(*) as count FROM participants WHERE session_id = ?')
    .get(session.id);

  res.json({
    session,
    quiz,
    participant_count: participantCount.count,
  });
});

// POST /api/sessions/:roomCode/join — join a session
router.post('/:roomCode/join', authMiddleware, [
  body('nickname').optional().trim().isLength({ min: 1, max: 30 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = getDb();
  const session = db.prepare('SELECT * FROM quiz_sessions WHERE room_code = ?').get(req.params.roomCode);

  if (!session) return res.status(404).json({ error: 'Комната не найдена' });
  if (session.status !== 'waiting') return res.status(400).json({ error: 'Квиз уже начался' });

  // Check if already joined
  const existing = db.prepare('SELECT * FROM participants WHERE session_id = ? AND user_id = ?')
    .get(session.id, req.user.id);
  if (existing) {
    return res.status(409).json({ error: 'Вы уже присоединились к этому квизу', participant: existing });
  }

  const nickname = req.body.nickname || req.user.username;

  const result = db.prepare(
    'INSERT INTO participants (session_id, user_id, nickname) VALUES (?, ?, ?)'
  ).run(session.id, req.user.id, nickname);

  const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json({ participant });
});

// GET /api/sessions/:roomCode/results — get leaderboard
router.get('/:roomCode/results', (req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM quiz_sessions WHERE room_code = ?').get(req.params.roomCode);

  if (!session) return res.status(404).json({ error: 'Комната не найдена' });

  const leaderboard = db.prepare(`
    SELECT nickname, total_score, correct_count, total_time_ms,
           RANK() OVER (ORDER BY total_score DESC, total_time_ms ASC) as rank
    FROM participants
    WHERE session_id = ?
    ORDER BY total_score DESC, total_time_ms ASC
  `).all(session.id);

  res.json({ leaderboard });
});

module.exports = router;

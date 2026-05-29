const express = require('express');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// GET /api/users/me/history
router.get('/me/history', (req, res) => {
  const db = getDb();

  // Participations
  const participations = db.prepare(`
    SELECT
      p.id, p.nickname, p.total_score, p.correct_count, p.total_time_ms,
      qs.room_code, qs.status as session_status, qs.finished_at,
      qz.title as quiz_title, qz.id as quiz_id
    FROM participants p
    JOIN quiz_sessions qs ON p.session_id = qs.id
    JOIN quizzes qz ON qs.quiz_id = qz.id
    WHERE p.user_id = ?
    ORDER BY qs.finished_at DESC
    LIMIT 50
  `).all(req.user.id);

  // Organized quizzes
  const organized = db.prepare(`
    SELECT qz.*,
      (SELECT COUNT(*) FROM quiz_sessions WHERE quiz_id = qz.id) as session_count
    FROM quizzes qz
    WHERE qz.organizer_id = ?
    ORDER BY qz.updated_at DESC
    LIMIT 50
  `).all(req.user.id);

  res.json({ participations, organized });
});

// GET /api/users/me/stats
router.get('/me/stats', (req, res) => {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT p.id) as total_played,
      COALESCE(AVG(p.total_score), 0) as avg_score,
      COALESCE(MIN(p.rank), 0) as best_rank,
      COALESCE(SUM(p.correct_count), 0) as total_correct,
      COALESCE(SUM(
        (SELECT COUNT(*) FROM answers WHERE participant_id = p.id)
      ), 0) as total_questions_answered
    FROM participants p
    JOIN quiz_sessions qs ON p.session_id = qs.id
    WHERE p.user_id = ?
  `).get(req.user.id);

  const organizedCount = db.prepare(
    'SELECT COUNT(*) as count FROM quizzes WHERE organizer_id = ?'
  ).get(req.user.id);

  res.json({
    total_played: stats.total_played,
    total_organized: organizedCount.count,
    avg_score: Math.round(stats.avg_score),
    best_rank: stats.best_rank || null,
    total_correct: stats.total_correct,
    total_questions_answered: stats.total_questions_answered,
  });
});

module.exports = router;

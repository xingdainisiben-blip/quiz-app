const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getDb } = require('../db');
const { authMiddleware, organizerOnly } = require('../middleware/auth');

const router = express.Router();

// All quiz routes require auth
router.use(authMiddleware);

// GET /api/quizzes — list organizer's quizzes
router.get('/', (req, res) => {
  const db = getDb();
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = 'SELECT * FROM quizzes WHERE organizer_id = ?';
  const params = [req.user.id];

  if (status && ['draft', 'ready', 'active', 'finished'].includes(status)) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const quizzes = db.prepare(query).all(...params);
  const countRow = db.prepare(
    'SELECT COUNT(*) as total FROM quizzes WHERE organizer_id = ?' + (status ? ' AND status = ?' : '')
  ).get(req.user.id, ...(status ? [status] : []));

  res.json({
    quizzes,
    total: countRow.total,
    page: parseInt(page),
    totalPages: Math.ceil(countRow.total / parseInt(limit)),
  });
});

// POST /api/quizzes — create quiz
router.post('/', organizerOnly, [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Название: 1-200 символов'),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('category').optional().trim(),
  body('time_per_question').optional().isInt({ min: 5, max: 300 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = getDb();
  const { title, description = '', category = 'general', time_per_question = 30 } = req.body;

  const result = db.prepare(
    'INSERT INTO quizzes (title, description, category, time_per_question, organizer_id) VALUES (?, ?, ?, ?, ?)'
  ).run(title, description, category, time_per_question, req.user.id);

  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ quiz });
});

// GET /api/quizzes/:id — get quiz with questions
router.get('/:id', (req, res) => {
  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);

  if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
  if (quiz.organizer_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });

  const questions = db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index').all(quiz.id);
  const questionsWithOptions = questions.map(q => {
    const options = db.prepare('SELECT * FROM options WHERE question_id = ? ORDER BY order_index').all(q.id);
    return { ...q, options };
  });

  res.json({ quiz: { ...quiz, questions: questionsWithOptions } });
});

// PUT /api/quizzes/:id — update quiz
router.put('/:id', organizerOnly, [
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('time_per_question').optional().isInt({ min: 5, max: 300 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
  if (quiz.organizer_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });
  if (quiz.status === 'active') return res.status(400).json({ error: 'Нельзя редактировать активный квиз' });

  const fields = ['title', 'description', 'category', 'time_per_question'];
  const updates = [];
  const params = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE quizzes SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  res.json({ quiz: updated });
});

// DELETE /api/quizzes/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
  if (quiz.organizer_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });

  db.prepare('DELETE FROM quizzes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/quizzes/:id/questions — add question
router.post('/:id/questions', organizerOnly, [
  body('type').isIn(['text_single', 'text_multiple', 'image_single', 'image_multiple']),
  body('text').trim().notEmpty(),
  body('options').isArray({ min: 2, max: 6 }),
  body('options.*.text').trim().notEmpty(),
  body('options.*.is_correct').isBoolean(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
  if (quiz.organizer_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });
  if (quiz.status === 'active') return res.status(400).json({ error: 'Нельзя редактировать активный квиз' });

  const { type, text, image_url, time_limit, points = 100, options } = req.body;

  // Get max order_index
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(order_index), -1) as max_order FROM questions WHERE quiz_id = ?'
  ).get(req.params.id);

  const qResult = db.prepare(
    'INSERT INTO questions (quiz_id, type, text, image_url, time_limit, points, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, type, text, image_url || null, time_limit || null, points, maxOrder.max_order + 1);

  const insertOption = db.prepare(
    'INSERT INTO options (question_id, text, is_correct, order_index) VALUES (?, ?, ?, ?)'
  );
  for (let i = 0; i < options.length; i++) {
    insertOption.run(qResult.lastInsertRowid, options[i].text, options[i].is_correct ? 1 : 0, i);
  }

  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(qResult.lastInsertRowid);
  const savedOptions = db.prepare('SELECT * FROM options WHERE question_id = ? ORDER BY order_index').all(question.id);
  res.status(201).json({ question: { ...question, options: savedOptions } });
});

// PUT /api/quizzes/:id/questions/:qid — update question
router.put('/:id/questions/:qid', organizerOnly, (req, res) => {
  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
  if (quiz.organizer_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });

  const question = db.prepare('SELECT * FROM questions WHERE id = ? AND quiz_id = ?')
    .get(req.params.qid, req.params.id);
  if (!question) return res.status(404).json({ error: 'Вопрос не найден' });

  const { type, text, image_url, time_limit, points, options } = req.body;

  if (type) db.prepare('UPDATE questions SET type = ? WHERE id = ?').run(type, question.id);
  if (text) db.prepare('UPDATE questions SET text = ? WHERE id = ?').run(text, question.id);
  if (image_url !== undefined) db.prepare('UPDATE questions SET image_url = ? WHERE id = ?').run(image_url, question.id);
  if (time_limit !== undefined) db.prepare('UPDATE questions SET time_limit = ? WHERE id = ?').run(time_limit, question.id);
  if (points) db.prepare('UPDATE questions SET points = ? WHERE id = ?').run(points, question.id);

  if (options && Array.isArray(options)) {
    db.prepare('DELETE FROM options WHERE question_id = ?').run(question.id);
    const insertOption = db.prepare(
      'INSERT INTO options (question_id, text, is_correct, order_index) VALUES (?, ?, ?, ?)'
    );
    for (let i = 0; i < options.length; i++) {
      insertOption.run(question.id, options[i].text, options[i].is_correct ? 1 : 0, i);
    }
  }

  const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(question.id);
  const savedOptions = db.prepare('SELECT * FROM options WHERE question_id = ? ORDER BY order_index').all(question.id);
  res.json({ question: { ...updated, options: savedOptions } });
});

// DELETE /api/quizzes/:id/questions/:qid
router.delete('/:id/questions/:qid', organizerOnly, (req, res) => {
  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
  if (quiz.organizer_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });

  db.prepare('DELETE FROM questions WHERE id = ? AND quiz_id = ?').run(req.params.qid, req.params.id);
  res.json({ success: true });
});

module.exports = router;

const { verifyToken } = require('../middleware/auth');
const { getDb } = require('../db');

/** @type {Map<string, NodeJS.Timeout>} */
const questionTimers = new Map();

/** @type {Map<string, number>} */
const questionStartTimes = new Map();

function setupSocket(io) {
  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Требуется авторизация'));
    }
    try {
      const user = verifyToken(token);
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Недействительный токен'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.user.id})`);

    // Join room as participant
    socket.on('session:join-room', ({ roomCode }) => {
      const db = getDb();
      const session = db.prepare('SELECT * FROM quiz_sessions WHERE room_code = ?').get(roomCode);
      if (!session) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }

      const participant = db.prepare(
        'SELECT * FROM participants WHERE session_id = ? AND user_id = ?'
      ).get(session.id, socket.user.id);

      if (!participant) {
        socket.emit('error', { message: 'Вы не присоединились к этому квизу' });
        return;
      }

      socket.join(`room:${roomCode}`);
      socket.roomCode = roomCode;
      socket.sessionId = session.id;
      socket.participantId = participant.id;

      // Notify room of updated count
      const count = db.prepare('SELECT COUNT(*) as count FROM participants WHERE session_id = ?').get(session.id);
      io.to(`room:${roomCode}`).emit('session:state', {
        status: session.status,
        participantCount: count.count,
      });
    });

    // Organizer joins room to control the quiz
    socket.on('session:join-organizer', ({ roomCode }) => {
      const db = getDb();
      const session = db.prepare('SELECT * FROM quiz_sessions WHERE room_code = ?').get(roomCode);
      if (!session) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }

      const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(session.quiz_id);
      if (quiz.organizer_id !== socket.user.id) {
        socket.emit('error', { message: 'Нет доступа' });
        return;
      }

      socket.join(`room:${roomCode}`);
      socket.roomCode = roomCode;
      socket.sessionId = session.id;
      socket.isOrganizer = true;

      const count = db.prepare('SELECT COUNT(*) as count FROM participants WHERE session_id = ?').get(session.id);
      socket.emit('session:state', {
        status: session.status,
        participantCount: count.count,
      });
    });

    // Start the quiz
    socket.on('session:start', ({ sessionId }) => {
      if (!socket.isOrganizer) return;

      const db = getDb();
      const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId);
      if (!session || session.status !== 'waiting') return;

      db.prepare("UPDATE quiz_sessions SET status = 'active', started_at = datetime('now'), current_question_index = -1 WHERE id = ?")
        .run(sessionId);
      db.prepare("UPDATE quizzes SET status = 'active', updated_at = datetime('now') WHERE id = ?")
        .run(session.quiz_id);

      const count = db.prepare('SELECT COUNT(*) as count FROM participants WHERE session_id = ?').get(sessionId);

      io.to(`room:${session.room_code}`).emit('session:state', {
        status: 'active',
        participantCount: count.count,
      });

      io.to(`room:${session.room_code}`).emit('quiz:started', {
        message: 'Квиз начинается!',
      });
    });

    // Show next question
    socket.on('question:next', ({ sessionId }) => {
      if (!socket.isOrganizer) return;
      showNextQuestion(io, sessionId);
    });

    // End current question early
    socket.on('question:end', ({ sessionId }) => {
      if (!socket.isOrganizer) return;
      endCurrentQuestion(io, sessionId);
    });

    // Submit answer
    socket.on('answer:submit', ({ sessionId, questionId, selectedOptionIds }) => {
      if (!socket.participantId) return;

      const db = getDb();
      const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId);
      if (!session || session.status !== 'active') return;

      // Check if already answered this question
      const existing = db.prepare(
        'SELECT * FROM answers WHERE participant_id = ? AND question_id = ?'
      ).get(socket.participantId, questionId);

      if (existing) {
        socket.emit('answer:ack', { received: true, timestamp: Date.now(), duplicate: true });
        return;
      }

      // Calculate response time
      const startKey = `${sessionId}:${questionId}`;
      const startTime = questionStartTimes.get(startKey) || Date.now();
      const responseTimeMs = Date.now() - startTime;

      // Grade the answer
      const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
      const correctOptions = db.prepare(
        'SELECT id FROM options WHERE question_id = ? AND is_correct = 1'
      ).all(questionId);
      const correctIds = correctOptions.map(o => o.id).sort();
      const selectedSorted = [...selectedOptionIds].sort();

      let isCorrect = false;
      if (question.type.endsWith('_single')) {
        isCorrect = selectedOptionIds.length === 1 && correctIds.includes(selectedOptionIds[0]);
      } else {
        isCorrect =
          correctIds.length === selectedSorted.length &&
          correctIds.every((id, i) => id === selectedSorted[i]);
      }

      const score = isCorrect ? question.points : 0;

      db.prepare(
        'INSERT INTO answers (participant_id, question_id, selected_option_ids, is_correct, score, response_time_ms) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(socket.participantId, questionId, JSON.stringify(selectedOptionIds), isCorrect ? 1 : 0, score, responseTimeMs);

      // Update participant totals
      db.prepare(
        'UPDATE participants SET total_score = total_score + ?, correct_count = correct_count + ?, total_time_ms = total_time_ms + ? WHERE id = ?'
      ).run(score, isCorrect ? 1 : 0, responseTimeMs, socket.participantId);

      socket.emit('answer:ack', { received: true, timestamp: Date.now() });

      // Send live stats to organizer
      if (socket.roomCode) {
        const answerCount = db.prepare(
          'SELECT COUNT(*) as count FROM answers WHERE question_id = ? AND participant_id IN (SELECT id FROM participants WHERE session_id = ?)'
        ).get(questionId, sessionId);

        const participantCount = db.prepare(
          'SELECT COUNT(*) as count FROM participants WHERE session_id = ?'
        ).get(sessionId);

        io.to(`room:${socket.roomCode}`).emit('organizer:stats', {
          currentQuestion: session.current_question_index,
          answersCount: answerCount.count,
          participantCount: participantCount.count,
        });
      }
    });

    // Finish quiz
    socket.on('session:finish', ({ sessionId }) => {
      if (!socket.isOrganizer) return;
      finishQuiz(io, sessionId);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user?.username}`);
    });
  });
}

function showNextQuestion(io, sessionId) {
  const db = getDb();

  // End any active question timer first
  clearQuestionTimer(sessionId);

  const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId);
  if (!session || session.status !== 'active') return;

  const nextIndex = session.current_question_index + 1;
  const questions = db.prepare(
    'SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index'
  ).all(session.quiz_id);

  if (nextIndex >= questions.length) {
    // No more questions, finish quiz
    finishQuiz(io, sessionId);
    return;
  }

  const question = questions[nextIndex];
  const options = db.prepare(
    'SELECT id, text, order_index FROM options WHERE question_id = ? ORDER BY order_index'
  ).all(question.id);

  const quiz = db.prepare('SELECT time_per_question FROM quizzes WHERE id = ?').get(session.quiz_id);
  const timeLimit = question.time_limit || quiz.time_per_question;

  // Update session
  db.prepare('UPDATE quiz_sessions SET current_question_index = ? WHERE id = ?').run(nextIndex, sessionId);

  // Record question start time
  const startKey = `${sessionId}:${question.id}`;
  questionStartTimes.set(startKey, Date.now());

  // Broadcast question to room (without correct answer data)
  io.to(`room:${session.room_code}`).emit('question:show', {
    question: {
      id: question.id,
      type: question.type,
      text: question.text,
      image_url: question.image_url,
      points: question.points,
    },
    options: options.map(o => ({ id: o.id, text: o.text, order_index: o.order_index })),
    questionIndex: nextIndex,
    totalQuestions: questions.length,
    timeLimit,
  });

  // Set timer for auto-close
  const timer = setTimeout(() => {
    endCurrentQuestion(io, sessionId);
  }, timeLimit * 1000);

  questionTimers.set(`session:${sessionId}`, timer);
}

function endCurrentQuestion(io, sessionId) {
  clearQuestionTimer(sessionId);

  const db = getDb();
  const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId);
  if (!session || session.status !== 'active') return;

  const question = db.prepare(
    'SELECT q.* FROM questions q WHERE q.quiz_id = ? AND q.order_index = ?'
  ).get(session.quiz_id, session.current_question_index);

  if (!question) return;

  const correctOptions = db.prepare(
    'SELECT id FROM options WHERE question_id = ? AND is_correct = 1'
  ).all(question.id);

  const answerCount = db.prepare(
    'SELECT COUNT(*) as count FROM answers WHERE question_id = ? AND participant_id IN (SELECT id FROM participants WHERE session_id = ?)'
  ).get(question.id, sessionId);

  const participantCount = db.prepare(
    'SELECT COUNT(*) as count FROM participants WHERE session_id = ?'
  ).get(sessionId);

  io.to(`room:${session.room_code}`).emit('question:closed', {
    correctOptionIds: correctOptions.map(o => o.id),
    stats: {
      answered: answerCount.count,
      total: participantCount.count,
    },
  });

  // Send individual results to each participant
  const participants = db.prepare('SELECT * FROM participants WHERE session_id = ?').all(sessionId);
  for (const p of participants) {
    const answer = db.prepare(
      'SELECT * FROM answers WHERE participant_id = ? AND question_id = ?'
    ).get(p.id, question.id);

    const sockets = io.sockets.sockets;
    for (const [sid, s] of sockets) {
      if (s.participantId === p.id) {
        s.emit('answer:result', {
          correct: answer ? answer.is_correct === 1 : false,
          score: answer ? answer.score : 0,
          correctOptionIds: correctOptions.map(o => o.id),
        });
      }
    }
  }

  // Send current leaderboard
  sendLeaderboard(io, session);
}

function finishQuiz(io, sessionId) {
  clearQuestionTimer(sessionId);

  const db = getDb();
  const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(sessionId);
  if (!session || session.status === 'finished') return;

  db.prepare("UPDATE quiz_sessions SET status = 'finished', finished_at = datetime('now') WHERE id = ?")
    .run(sessionId);
  db.prepare("UPDATE quizzes SET status = 'finished', updated_at = datetime('now') WHERE id = ?")
    .run(session.quiz_id);

  const leaderboard = db.prepare(`
    SELECT nickname, total_score, correct_count, total_time_ms,
           RANK() OVER (ORDER BY total_score DESC, total_time_ms ASC) as rank
    FROM participants
    WHERE session_id = ?
    ORDER BY total_score DESC, total_time_ms ASC
  `).all(sessionId);

  io.to(`room:${session.room_code}`).emit('quiz:finished', { leaderboard });
  io.to(`room:${session.room_code}`).emit('session:state', {
    status: 'finished',
    participantCount: leaderboard.length,
  });
}

function sendLeaderboard(io, session) {
  const db = getDb();
  const leaderboard = db.prepare(`
    SELECT nickname, total_score, correct_count, total_time_ms,
           RANK() OVER (ORDER BY total_score DESC, total_time_ms ASC) as rank
    FROM participants
    WHERE session_id = ?
    ORDER BY total_score DESC, total_time_ms ASC
  `).all(session.id);

  io.to(`room:${session.room_code}`).emit('quiz:leaderboard', { rankings: leaderboard.slice(0, 10) });
}

function clearQuestionTimer(sessionId) {
  const key = `session:${sessionId}`;
  const timer = questionTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    questionTimers.delete(key);
  }
}

module.exports = { setupSocket };

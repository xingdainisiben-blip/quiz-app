const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'quiz.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'participant' CHECK(role IN ('organizer', 'participant')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      time_per_question INTEGER DEFAULT 30,
      organizer_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'ready', 'active', 'finished')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('text_single', 'text_multiple', 'image_single', 'image_multiple')),
      text TEXT NOT NULL,
      image_url TEXT,
      time_limit INTEGER,
      points INTEGER DEFAULT 100,
      order_index INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
      room_code TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'active', 'finished')),
      current_question_index INTEGER DEFAULT -1,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES quiz_sessions(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      nickname TEXT NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      total_score INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      total_time_ms INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL REFERENCES participants(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      selected_option_ids TEXT NOT NULL DEFAULT '[]',
      is_correct INTEGER,
      score INTEGER DEFAULT 0,
      response_time_ms INTEGER DEFAULT 0,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_quizzes_organizer ON quizzes(organizer_id);
    CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
    CREATE INDEX IF NOT EXISTS idx_options_question ON options(question_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_room ON quiz_sessions(room_code);
    CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
    CREATE INDEX IF NOT EXISTS idx_answers_participant ON answers(participant_id);
  `);
}

module.exports = { getDb };

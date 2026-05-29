# Quiz Application — Complete Specification

## 1. Data Models

### User
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| username | TEXT | UNIQUE, NOT NULL, 3-30 chars |
| email | TEXT | UNIQUE, NOT NULL |
| password_hash | TEXT | NOT NULL (bcrypt) |
| role | TEXT | 'organizer' | 'participant', DEFAULT 'participant' |
| created_at | TEXT | ISO 8601 |

### Quiz
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| title | TEXT | NOT NULL, 1-200 chars |
| description | TEXT | 0-1000 chars |
| category | TEXT | DEFAULT 'general' |
| time_per_question | INTEGER | seconds, DEFAULT 30 |
| organizer_id | INTEGER | FK → User.id |
| status | TEXT | 'draft' | 'ready' | 'active' | 'finished' |
| created_at | TEXT | ISO 8601 |
| updated_at | TEXT | ISO 8601 |

### Question
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| quiz_id | INTEGER | FK → Quiz.id, ON DELETE CASCADE |
| type | TEXT | 'text_single' | 'text_multiple' | 'image_single' | 'image_multiple' |
| text | TEXT | NOT NULL |
| image_url | TEXT | nullable (required for image_* types) |
| time_limit | INTEGER | seconds, nullable (inherits from quiz) |
| points | INTEGER | DEFAULT 100 |
| order_index | INTEGER | NOT NULL |
| created_at | TEXT | ISO 8601 |

### Option
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| question_id | INTEGER | FK → Question.id, ON DELETE CASCADE |
| text | TEXT | NOT NULL |
| is_correct | BOOLEAN | DEFAULT false |
| order_index | INTEGER | NOT NULL |

### QuizSession
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| quiz_id | INTEGER | FK → Quiz.id |
| room_code | TEXT | UNIQUE, 6-char alphanumeric |
| status | TEXT | 'waiting' | 'active' | 'finished' |
| current_question_index | INTEGER | DEFAULT -1 |
| started_at | TEXT | ISO 8601, nullable |
| finished_at | TEXT | ISO 8601, nullable |

### Participant
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| session_id | INTEGER | FK → QuizSession.id |
| user_id | INTEGER | FK → User.id |
| nickname | TEXT | NOT NULL |
| joined_at | TEXT | ISO 8601 |
| total_score | INTEGER | DEFAULT 0 |
| correct_count | INTEGER | DEFAULT 0 |
| total_time_ms | INTEGER | DEFAULT 0 |

### Answer
| Field | Type | Constraints |
|-------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| participant_id | INTEGER | FK → Participant.id |
| question_id | INTEGER | FK → Question.id |
| selected_option_ids | TEXT | JSON array of option IDs |
| is_correct | BOOLEAN | nullable (null = not yet graded) |
| score | INTEGER | DEFAULT 0 |
| response_time_ms | INTEGER | time from question shown to answer submitted |
| submitted_at | TEXT | ISO 8601 |

---

## 2. API Contracts

### Auth Routes — `/api/auth`

```
POST /api/auth/register
  Body: { username, email, password, role? }
  Response: { token, user: { id, username, email, role } }
  Errors: 400 (validation), 409 (username/email taken)

POST /api/auth/login
  Body: { email, password }
  Response: { token, user: { id, username, email, role } }
  Errors: 401 (invalid credentials)

GET /api/auth/me
  Headers: Authorization: Bearer <token>
  Response: { user: { id, username, email, role } }
  Errors: 401 (unauthorized)
```

### Quiz Routes — `/api/quizzes`

```
GET /api/quizzes
  Headers: Authorization
  Query: ?status=draft&page=1&limit=20
  Response: { quizzes: [...], total, page, totalPages }
  Note: Organizers see their own quizzes

POST /api/quizzes
  Headers: Authorization (organizer only)
  Body: { title, description?, category?, time_per_question? }
  Response: { quiz }
  Errors: 400, 403

GET /api/quizzes/:id
  Headers: Authorization
  Response: { quiz (with questions and options) }
  Errors: 403, 404

PUT /api/quizzes/:id
  Headers: Authorization (owner only)
  Body: { title?, description?, category?, time_per_question? }
  Response: { quiz }
  Errors: 400, 403, 404

DELETE /api/quizzes/:id
  Headers: Authorization (owner only)
  Response: { success: true }
  Errors: 403, 404

POST /api/quizzes/:id/questions
  Headers: Authorization (owner only)
  Body: { type, text, image_url?, time_limit?, points?, options: [{ text, is_correct, order_index }] }
  Response: { question }
  Errors: 400, 403, 404

PUT /api/quizzes/:id/questions/:qid
  Headers: Authorization (owner only)
  Body: { type?, text?, image_url?, time_limit?, points?, options? }
  Response: { question }
  Errors: 400, 403, 404

DELETE /api/quizzes/:id/questions/:qid
  Headers: Authorization (owner only)
  Response: { success: true }
```

### Session Routes — `/api/sessions`

```
POST /api/sessions
  Headers: Authorization (organizer)
  Body: { quiz_id }
  Response: { session (with room_code) }
  Errors: 400, 403, 404

GET /api/sessions/:roomCode
  Response: { session, quiz, participant_count }
  Errors: 404

POST /api/sessions/:roomCode/join
  Headers: Authorization
  Body: { nickname? }
  Response: { participant, token (session-scoped) }
  Errors: 404, 409 (already joined), 400 (session not waiting)

GET /api/sessions/:roomCode/results
  Response: { leaderboard: [{ nickname, total_score, correct_count, rank }] }
```

### User Routes — `/api/users`

```
GET /api/users/me/history
  Headers: Authorization
  Response: { participations: [...], organized: [...] }

GET /api/users/me/stats
  Headers: Authorization
  Response: { total_played, total_organized, avg_score, best_rank, total_correct, total_questions }
```

---

## 3. WebSocket Events Protocol

### Connection
- Client connects with `auth_token` as query param
- Server validates JWT, associates socket with user

### Organizer → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `session:start` | `{ sessionId }` | Start the quiz (status → active) |
| `question:next` | `{ sessionId }` | Show next question |
| `question:end` | `{ sessionId }` | End current question early |
| `session:finish` | `{ sessionId }` | End quiz and calculate results |

### Server → All Participants in Room

| Event | Payload | Description |
|-------|---------|-------------|
| `session:state` | `{ status, participantCount }` | Room state update |
| `question:show` | `{ question, questionIndex, totalQuestions, timeLimit }` | Display question |
| `question:closed` | `{ correctOptionIds, stats: { answered, total } }` | Question ended |
| `quiz:leaderboard` | `{ rankings: [{ rank, nickname, total_score }], currentUserRank? }` | Leaderboard update |
| `quiz:finished` | `{ leaderboard: [...] }` | Final results |

### Server → Organizer Only

| Event | Payload | Description |
|-------|---------|-------------|
| `organizer:stats` | `{ currentQuestion, answersCount, participantCount }` | Live stats for dashboard |

### Participant → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `answer:submit` | `{ sessionId, questionId, selectedOptionIds: number[] }` | Submit answer |
| `session:join-room` | `{ roomCode }` | Join socket room |

### Server → Participant Only

| Event | Payload | Description |
|-------|---------|-------------|
| `answer:ack` | `{ received: true, timestamp }` | Confirm answer received |
| `answer:result` | `{ correct, score, correctOptionIds }` | Individual result (after question closes) |

---

## 4. UI State Machines

### Login Page
States: idle → submitting → error | success(redirect)

### Register Page
States: idle → submitting → validation_error | server_error | success(redirect)

### Dashboard
States: loading → empty(no quizzes) | list → error

### Create/Edit Quiz
States: form_idle → saving → validation_error | success(redirect to lobby)

### Quiz Lobby (Organizer)
States: waiting(show room code) → active(current question N/M) → finished(show leaderboard)
Sub-states (active): showing_question → collecting_answers → showing_result → (loop)

### Join Quiz
States: code_input → joining → invalid_code | joined(→ wait room)

### Player Wait Room
States: waiting → active(quiz started)

### Player Answer
States: showing_question(countdown) → answer_selected → answer_submitted → waiting_next

### Leaderboard
States: loading → results → empty

### Profile
States: loading → history | stats → error

---

## 5. Route Tree

```
/                       → Home page
/login                  → Login page
/register               → Register page
/dashboard              → Dashboard (requires auth)
/quiz/create            → Create quiz (requires organizer)
/quiz/:id/edit          → Edit quiz (requires owner)
/quiz/:id/lobby         → Lobby / control panel (requires owner)
/join                   → Join quiz page (requires auth)
/play/:roomCode         → Player view (requires auth)
/profile                → Profile / history (requires auth)
```

---

## 6. Security Rules

1. All passwords hashed with bcrypt (10 rounds)
2. JWT with 24h expiry for web sessions
3. Organizer-only routes protected by role middleware
4. Quiz edit/delete restricted to owner
5. Session-scoped socket rooms (room_code)
6. Answer timeout enforced server-side (late answers rejected)
7. Input validation on all routes (express-validator style)
8. CORS configured for frontend origin only
9. Rate limiting on auth routes

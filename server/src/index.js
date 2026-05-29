require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quiz');
const sessionRoutes = require('./routes/session');
const userRoutes = require('./routes/user');
const { setupSocket } = require('./socket/quizHandler');

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO
setupSocket(io);

server.listen(PORT, () => {
  console.log(`[QuizApp] Server running on http://localhost:${PORT}`);
  console.log(`[QuizApp] WebSocket ready`);
  console.log(`[QuizApp] CORS origin: ${CLIENT_URL}`);
});

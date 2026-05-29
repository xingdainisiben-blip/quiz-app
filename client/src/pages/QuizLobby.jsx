import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { sessions, quizzes } from '../lib/api';

export default function QuizLobby() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();

  const [quiz, setQuiz] = useState(null);
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | creating | waiting | active | finished
  const [participantCount, setParticipantCount] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentOptions, setCurrentOptions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(-1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answersCount, setAnswersCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Load quiz data
  useEffect(() => {
    quizzes.get(id)
      .then(data => setQuiz(data.quiz))
      .catch(err => setError(err.message));
  }, [id]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !session) return;

    socket.on('session:state', (data) => {
      setStatus(data.status);
      setParticipantCount(data.participantCount);
    });

    socket.on('quiz:started', () => {
      setStatus('active');
    });

    socket.on('question:show', (data) => {
      setCurrentQuestion(data.question);
      setCurrentOptions(data.options);
      setQuestionIndex(data.questionIndex);
      setTotalQuestions(data.totalQuestions);
      setTimeLeft(data.timeLimit);
      setAnswersCount(0);
    });

    socket.on('organizer:stats', (data) => {
      setAnswersCount(data.answersCount);
      setParticipantCount(data.participantCount);
    });

    socket.on('question:closed', (data) => {
      setCurrentQuestion(null);
      setCurrentOptions([]);
    });

    socket.on('quiz:leaderboard', (data) => {
      setLeaderboard(data.rankings);
    });

    socket.on('quiz:finished', (data) => {
      setStatus('finished');
      setLeaderboard(data.leaderboard);
      setCurrentQuestion(null);
    });

    socket.on('error', (data) => {
      setError(data.message);
    });

    return () => {
      socket.off('session:state');
      socket.off('quiz:started');
      socket.off('question:show');
      socket.off('organizer:stats');
      socket.off('question:closed');
      socket.off('quiz:leaderboard');
      socket.off('quiz:finished');
      socket.off('error');
    };
  }, [socket, session]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleCreateSession = async () => {
    setError('');
    try {
      const data = await sessions.create({ quiz_id: parseInt(id) });
      setSession(data.session);
      setStatus('waiting');

      // Join as organizer via socket
      if (socket) {
        socket.emit('session:join-organizer', { roomCode: data.session.room_code });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStartQuiz = () => {
    if (!socket || !session) return;
    socket.emit('session:start', { sessionId: session.id });
  };

  const handleNextQuestion = () => {
    if (!socket || !session) return;
    socket.emit('question:next', { sessionId: session.id });
  };

  const handleEndQuestion = () => {
    if (!socket || !session) return;
    socket.emit('question:end', { sessionId: session.id });
  };

  const handleFinishQuiz = () => {
    if (!socket || !session) return;
    if (!confirm('Завершить квиз? Результаты будут показаны участникам.')) return;
    socket.emit('session:finish', { sessionId: session.id });
  };

  const copyRoomCode = () => {
    if (!session) return;
    navigator.clipboard.writeText(session.room_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (error && !quiz) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Ошибка</h2>
          <p className="text-gray-600">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary mt-4">Назад</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-primary-600 mb-4 inline-block">
        ← Назад
      </button>

      <h1 className="text-3xl font-bold mb-2">{quiz?.title || 'Загрузка...'}</h1>
      <p className="text-gray-600 mb-6">Панель управления квизом</p>

      {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mb-4">{error}</div>}

      {/* Socket connection status */}
      {session && (
        <div className={`text-sm mb-4 ${connected ? 'text-green-600' : 'text-red-600'}`}>
          {connected ? '🟢 Подключено' : '🔴 Отключено'}
        </div>
      )}

      {/* Not started yet — create session */}
      {!session && (
        <div className="card text-center py-12">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-xl font-bold mb-2">Всё готово к запуску</h2>
          <p className="text-gray-600 mb-6">
            {quiz?.questions?.length || 0} вопросов в этом квизе
          </p>
          <button onClick={handleCreateSession} className="btn-primary text-lg !px-8 !py-3">
            Создать комнату
          </button>
        </div>
      )}

      {/* Waiting for players */}
      {status === 'waiting' && session && (
        <div className="space-y-6">
          <div className="card text-center bg-gradient-to-br from-primary-50 to-accent-50 border-primary-200">
            <p className="text-sm text-gray-600 mb-2">Код комнаты</p>
            <div className="text-6xl font-bold tracking-[0.3em] text-primary-700 mb-4 font-mono select-all">
              {session.room_code}
            </div>
            <button onClick={copyRoomCode} className="btn-outline mb-2">
              {copied ? '✅ Скопировано!' : '📋 Копировать'}
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Отправьте этот код участникам для подключения
            </p>
          </div>

          <div className="card text-center">
            <div className="text-4xl mb-2">👥 {participantCount}</div>
            <p className="text-gray-600 mb-4">участников в комнате</p>
            <button onClick={handleStartQuiz} className="btn-accent text-lg !px-8 !py-3" disabled={participantCount === 0}>
              Начать квиз!
            </button>
            {participantCount === 0 && (
              <p className="text-sm text-gray-500 mt-2">Ожидание участников...</p>
            )}
          </div>
        </div>
      )}

      {/* Active quiz */}
      {status === 'active' && (
        <div className="space-y-6">
          {/* Stats bar */}
          <div className="card flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold">{questionIndex + 1}</span>
              <span className="text-gray-500"> / {totalQuestions}</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-lg font-bold">{participantCount}</div>
                <div className="text-xs text-gray-500">участников</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{answersCount}</div>
                <div className="text-xs text-gray-500">ответов</div>
              </div>
            </div>
            <button onClick={handleFinishQuiz} className="btn-danger text-sm">
              Завершить
            </button>
          </div>

          {/* Current question display */}
          {currentQuestion ? (
            <div className="card border-2 border-primary-200">
              <div className="flex items-center justify-between mb-4">
                <span className="badge-blue">Вопрос {questionIndex + 1}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${timeLeft <= 5 ? 'text-red-600 animate-pulse' : ''}`}>
                    ⏱ {timeLeft}с
                  </span>
                  <button onClick={handleEndQuestion} className="btn-secondary text-sm">Завершить досрочно</button>
                </div>
              </div>

              <h2 className="text-xl font-bold mb-4">{currentQuestion.text}</h2>
              {currentQuestion.image_url && (
                <img src={currentQuestion.image_url} alt="" className="mb-4 max-h-64 rounded-lg" />
              )}

              <div className="grid grid-cols-2 gap-3">
                {currentOptions.map(o => (
                  <div key={o.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-center">
                    {o.text}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${participantCount > 0 ? (answersCount / participantCount) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600">{answersCount}/{participantCount}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-8">
              <p className="text-gray-600 mb-4">Готовы к следующему вопросу?</p>
              <button onClick={handleNextQuestion} className="btn-primary text-lg !px-8 !py-3">
                {questionIndex < totalQuestions - 1 ? 'Следующий вопрос ▶️' : 'Показать результаты 🏆'}
              </button>
            </div>
          )}

          {/* Live leaderboard */}
          {leaderboard.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-lg mb-4">🏆 Текущий рейтинг</h3>
              <div className="space-y-2">
                {leaderboard.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? 'bg-yellow-400 text-white' :
                        i === 1 ? 'bg-gray-300 text-white' :
                        i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100'
                      }`}>
                        {p.rank}
                      </span>
                      <span className="font-medium">{p.nickname}</span>
                    </div>
                    <span className="font-bold">{p.total_score} бал.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Finished */}
      {status === 'finished' && (
        <div className="space-y-6">
          <div className="card text-center bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold mb-2">Квиз завершён!</h2>
            <p className="text-gray-600">Результаты сохранены</p>
          </div>

          {leaderboard.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-xl mb-4">🏆 Итоговая таблица лидеров</h3>
              <div className="space-y-2">
                {leaderboard.map((p, i) => (
                  <div key={i} className={`flex items-center justify-between py-3 px-4 rounded-lg ${
                    i === 0 ? 'bg-yellow-50 border border-yellow-200' : 'border-b'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        i === 0 ? 'bg-yellow-400 text-white text-2xl' :
                        i === 1 ? 'bg-gray-300 text-white' :
                        i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100'
                      }`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : p.rank}
                      </span>
                      <div>
                        <div className="font-bold text-lg">{p.nickname}</div>
                        <div className="text-sm text-gray-500">{p.correct_count} прав. ответов</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xl">{p.total_score}</div>
                      <div className="text-xs text-gray-500">баллов</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <button onClick={() => navigate('/dashboard')} className="btn-primary">
              Вернуться к списку
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

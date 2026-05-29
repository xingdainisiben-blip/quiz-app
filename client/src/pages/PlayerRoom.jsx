import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

export default function PlayerRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const { user } = useAuth();

  // States: loading | waiting | active | answered | between_questions | finished
  const [status, setStatus] = useState('loading');
  const [participantCount, setParticipantCount] = useState(0);
  const [question, setQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(-1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [error, setError] = useState('');
  const [answerAck, setAnswerAck] = useState(false);

  // Join the room via socket
  useEffect(() => {
    if (!socket || !roomCode) return;

    // Join the room
    socket.emit('session:join-room', { roomCode });

    const handleState = (data) => {
      setStatus(data.status);
      setParticipantCount(data.participantCount);
    };

    const handleStarted = () => {
      setStatus('active');
      setSubmitted(false);
      setLastResult(null);
      setSelectedOptions([]);
    };

    const handleQuestionShow = (data) => {
      setQuestion(data.question);
      setOptions(data.options);
      setQuestionIndex(data.questionIndex);
      setTotalQuestions(data.totalQuestions);
      setTimeLeft(data.timeLimit);
      setSubmitted(false);
      setSelectedOptions([]);
      setLastResult(null);
      setAnswerAck(false);
      setStatus('active');
    };

    const handleQuestionClosed = (data) => {
      setStatus('between_questions');
      // Keep showing the question but mark as closed
    };

    const handleAnswerResult = (data) => {
      setLastResult(data);
    };

    const handleLeaderboard = (data) => {
      setLeaderboard(data.rankings);
    };

    const handleFinished = (data) => {
      setStatus('finished');
      setFinalLeaderboard(data.leaderboard);
      setQuestion(null);
      setOptions([]);
    };

    const handleError = (data) => {
      setError(data.message);
    };

    socket.on('session:state', handleState);
    socket.on('quiz:started', handleStarted);
    socket.on('question:show', handleQuestionShow);
    socket.on('question:closed', handleQuestionClosed);
    socket.on('answer:result', handleAnswerResult);
    socket.on('quiz:leaderboard', handleLeaderboard);
    socket.on('quiz:finished', handleFinished);
    socket.on('error', handleError);

    return () => {
      socket.off('session:state', handleState);
      socket.off('quiz:started', handleStarted);
      socket.off('question:show', handleQuestionShow);
      socket.off('question:closed', handleQuestionClosed);
      socket.off('answer:result', handleAnswerResult);
      socket.off('quiz:leaderboard', handleLeaderboard);
      socket.off('quiz:finished', handleFinished);
      socket.off('error', handleError);
    };
  }, [socket, roomCode]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || status !== 'active' || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, status, submitted]);

  const toggleOption = (optionId) => {
    if (submitted || !question) return;

    if (question.type.endsWith('_single')) {
      setSelectedOptions([optionId]);
    } else {
      setSelectedOptions(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  const submitAnswer = () => {
    if (submitted || selectedOptions.length === 0 || !socket || !question) return;

    socket.emit('answer:submit', {
      sessionId: socket.sessionId,
      questionId: question.id,
      selectedOptionIds: selectedOptions,
    });

    // Optimistic update — server will confirm
    setSubmitted(true);
    setAnswerAck(true);
  };

  // Determine if answer is correct based on lastResult
  const isCorrect = lastResult?.correct;
  const earnedScore = lastResult?.score || 0;

  if (status === 'loading') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Подключение к комнате {roomCode}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-gray-600">
          Комната: <span className="font-mono font-bold">{roomCode}</span>
        </div>
        <div className={`text-sm ${connected ? 'text-green-600' : 'text-red-600'}`}>
          {connected ? '🟢' : '🔴'}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mb-4">{error}</div>}

      {/* Waiting state */}
      {status === 'waiting' && (
        <div className="card text-center py-16">
          <div className="text-6xl mb-6 animate-bounce">⏳</div>
          <h2 className="text-2xl font-bold mb-2">Ожидание начала</h2>
          <p className="text-gray-600 mb-4">Организатор скоро запустит квиз</p>
          <div className="text-4xl font-bold text-primary-600">{participantCount}</div>
          <p className="text-gray-500">участников в комнате</p>
        </div>
      )}

      {/* Active question */}
      {(status === 'active' || status === 'answered') && question && (
        <div className="space-y-6 animate-slide-up">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <span className="badge-blue">Вопрос {questionIndex + 1} из {totalQuestions}</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
              />
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-center justify-center">
            <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center text-2xl font-bold ${
              timeLeft <= 5 ? 'border-red-500 text-red-600 animate-pulse' :
              timeLeft <= 10 ? 'border-yellow-500 text-yellow-600' :
              'border-primary-500 text-primary-600'
            }`}>
              {timeLeft}
            </div>
          </div>

          {/* Question text */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <span className="badge-blue">{question.points} бал.</span>
              <span className="badge-gray">
                {question.type.endsWith('single') ? 'Один ответ' : 'Несколько ответов'}
              </span>
            </div>

            <h2 className="text-xl font-bold mb-4">{question.text}</h2>

            {question.image_url && (
              <img
                src={question.image_url}
                alt="Question"
                className="mb-4 max-h-64 rounded-lg mx-auto"
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}

            {/* Options */}
            <div className="space-y-3">
              {options.map(opt => {
                const isSelected = selectedOptions.includes(opt.id);
                const isCorrectOpt = lastResult?.correctOptionIds?.includes(opt.id);

                let optClass = 'border-gray-200 hover:border-primary-300 hover:bg-primary-50';
                if (submitted) {
                  if (isCorrectOpt) {
                    optClass = 'border-green-500 bg-green-50';
                  } else if (isSelected && !isCorrectOpt) {
                    optClass = 'border-red-500 bg-red-50';
                  } else {
                    optClass = 'border-gray-200 opacity-60';
                  }
                } else if (isSelected) {
                  optClass = 'border-primary-500 bg-primary-50 ring-2 ring-primary-200';
                }

                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    disabled={submitted}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${optClass} ${
                      submitted ? 'cursor-default' : 'cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-${question.type.endsWith('single') ? 'full' : 'lg'} border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-primary-600 bg-primary-600' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <span className="text-white text-sm">{question.type.endsWith('single') ? '●' : '✓'}</span>
                        )}
                      </div>
                      <span className="font-medium">{opt.text}</span>
                      {submitted && isCorrectOpt && <span className="ml-auto text-green-600">✓ Правильно</span>}
                      {submitted && isSelected && !isCorrectOpt && <span className="ml-auto text-red-600">✗</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Submit button */}
            {!submitted && (
              <button
                onClick={submitAnswer}
                disabled={selectedOptions.length === 0}
                className="btn-primary w-full !py-3 mt-6 text-lg"
              >
                {selectedOptions.length > 0 ? 'Ответить 🔒' : 'Выберите вариант ответа'}
              </button>
            )}

            {answerAck && submitted && (
              <div className="mt-4 text-center text-green-600 font-medium animate-bounce-in">
                ✅ Ответ принят! Ожидайте...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Between questions */}
      {status === 'between_questions' && (
        <div className="card text-center py-12 animate-slide-up">
          <div className="text-5xl mb-4">
            {isCorrect === true ? '🎉' : isCorrect === false ? '😔' : '⏳'}
          </div>
          <h2 className="text-xl font-bold mb-2">
            {isCorrect === true ? 'Правильно!' : isCorrect === false ? 'Неверно' : 'Время вышло!'}
          </h2>
          {earnedScore > 0 && (
            <p className="text-lg text-primary-600 font-bold">+{earnedScore} баллов!</p>
          )}
          <p className="text-gray-600 mt-2">Ожидайте следующий вопрос...</p>

          {/* Mini leaderboard */}
          {leaderboard.length > 0 && (
            <div className="mt-6 text-left">
              <h3 className="font-bold text-sm text-gray-600 mb-2">🏆 Топ-5</h3>
              <div className="space-y-1">
                {leaderboard.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
                    <span>{p.rank}. {p.nickname}</span>
                    <span className="font-bold">{p.total_score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Finished */}
      {status === 'finished' && (
        <div className="space-y-6 animate-slide-up">
          <div className="card text-center bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold mb-2">Квиз завершён!</h2>
            <p className="text-gray-600">Спасибо за участие!</p>
          </div>

          {/* Final leaderboard */}
          {finalLeaderboard.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-xl mb-4">🏆 Итоговый рейтинг</h3>
              <div className="space-y-2">
                {finalLeaderboard.map((p, i) => (
                  <div key={i} className={`flex items-center justify-between py-3 px-4 rounded-lg ${
                    p.nickname === user?.username ? 'bg-primary-50 border border-primary-200' :
                    i === 0 ? 'bg-yellow-50 border border-yellow-200' : 'border-b'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        i === 0 ? 'bg-yellow-400 text-white text-xl' :
                        i === 1 ? 'bg-gray-300 text-white' :
                        i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100'
                      }`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : p.rank}
                      </span>
                      <div>
                        <div className="font-bold">{p.nickname}</div>
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

          <div className="text-center flex gap-3 justify-center">
            <button onClick={() => navigate('/dashboard')} className="btn-primary">
              В профиль
            </button>
            <button onClick={() => navigate('/join')} className="btn-secondary">
              К другому квизу
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

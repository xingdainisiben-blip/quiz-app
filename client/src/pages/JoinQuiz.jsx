import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessions } from '../lib/api';

export default function JoinQuiz() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');

    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) {
      setError('Введите код комнаты');
      return;
    }

    setLoading(true);
    try {
      // First check if room exists
      await sessions.get(code);
      // Then join
      await sessions.join(code, { nickname: nickname.trim() || undefined });
      // Navigate to player room
      navigate(`/play/${code}`);
    } catch (err) {
      if (err.status === 409) {
        // Already joined — navigate anyway
        navigate(`/play/${code}`);
        return;
      }
      setError(err.message || 'Не удалось присоединиться');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">Присоединиться к квизу</h1>
        <p className="text-gray-600 text-center mb-6">Введите код комнаты от организатора</p>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="label">Код комнаты</label>
            <input
              type="text"
              className="input text-center text-3xl font-mono font-bold tracking-[0.3em] uppercase"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC123"
              autoFocus
            />
          </div>

          <div>
            <label className="label">Ваше имя (необязательно)</label>
            <input
              type="text"
              className="input"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              maxLength={30}
              placeholder="Оставьте пустым для использования имени профиля"
            />
          </div>

          <button type="submit" className="btn-primary w-full !py-3 text-lg" disabled={loading}>
            {loading ? 'Подключение...' : '🎮 Присоединиться'}
          </button>
        </form>
      </div>
    </div>
  );
}

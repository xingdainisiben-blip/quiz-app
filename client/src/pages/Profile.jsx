import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { users } from '../lib/api';

export default function Profile() {
  const { user } = useAuth();
  const [history, setHistory] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('stats');

  useEffect(() => {
    Promise.all([
      users.history().catch(() => ({ participations: [], organized: [] })),
      users.stats().catch(() => null),
    ])
      .then(([hist, st]) => {
        setHistory(hist);
        setStats(st);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="card mb-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-3xl">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{user?.username}</h1>
            <p className="text-gray-600">{user?.email}</p>
            <span className={user?.role === 'organizer' ? 'badge-blue mt-1' : 'badge-green mt-1'}>
              {user?.role === 'organizer' ? '🎤 Организатор' : '🎮 Участник'}
            </span>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('stats')}
          className={`btn ${tab === 'stats' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Статистика
        </button>
        <button
          onClick={() => setTab('participations')}
          className={`btn ${tab === 'participations' ? 'btn-primary' : 'btn-secondary'}`}
        >
          История участий
        </button>
        {user?.role === 'organizer' && (
          <button
            onClick={() => setTab('organized')}
            className={`btn ${tab === 'organized' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Проведённые квизы
          </button>
        )}
      </div>

      {/* Stats Tab */}
      {tab === 'stats' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Пройдено квизов', value: stats.total_played, icon: '🎯' },
            { label: 'Средний балл', value: stats.avg_score, icon: '📊' },
            { label: 'Правильных ответов', value: stats.total_correct, icon: '✅' },
            { label: 'Всего вопросов', value: stats.total_questions_answered, icon: '❓' },
            { label: 'Лучшее место', value: stats.best_rank ? `#${stats.best_rank}` : '—', icon: '🏆' },
            { label: 'Создано квизов', value: stats.total_organized, icon: '📝' },
          ].map((item, i) => (
            <div key={i} className="card text-center">
              <div className="text-3xl mb-2">{item.icon}</div>
              <div className="text-2xl font-bold text-primary-700">{item.value}</div>
              <div className="text-sm text-gray-600">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Participations Tab */}
      {tab === 'participations' && (
        <div className="space-y-3">
          {history?.participations?.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-5xl mb-4">🎮</div>
              <h2 className="text-xl font-bold mb-2">Нет участий</h2>
              <p className="text-gray-600">Вы ещё не участвовали ни в одном квизе</p>
            </div>
          ) : (
            history?.participations?.map((p) => (
              <div key={p.id} className="card flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <h3 className="font-bold">{p.quiz_title}</h3>
                  <p className="text-sm text-gray-500">
                    Комната: {p.room_code} · {new Date(p.finished_at).toLocaleDateString('ru')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">{p.total_score} бал.</div>
                  <div className="text-sm text-gray-500">{p.correct_count} прав.</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Organized Tab */}
      {tab === 'organized' && (
        <div className="space-y-3">
          {history?.organized?.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-5xl mb-4">📝</div>
              <h2 className="text-xl font-bold mb-2">Нет проведённых квизов</h2>
              <p className="text-gray-600">Создайте свой первый квиз!</p>
            </div>
          ) : (
            history?.organized?.map((q) => (
              <div key={q.id} className="card flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <h3 className="font-bold">{q.title}</h3>
                  <p className="text-sm text-gray-500">
                    {q.category} · {q.session_count} сессий · {new Date(q.updated_at).toLocaleDateString('ru')}
                  </p>
                </div>
                <div>
                  <span className={`badge ${
                    q.status === 'finished' ? 'badge-green' :
                    q.status === 'active' ? 'badge-yellow' :
                    q.status === 'ready' ? 'badge-blue' : 'badge-gray'
                  }`}>
                    {q.status === 'finished' ? 'Завершён' :
                     q.status === 'active' ? 'Активен' :
                     q.status === 'ready' ? 'Готов' : 'Черновик'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

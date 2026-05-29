import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'participant',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    setSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Ошибка регистрации');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Регистрация</h1>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Имя пользователя</label>
            <input
              type="text"
              className="input"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              required
              minLength={3}
              maxLength={30}
              placeholder="Ваш никнейм"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
              minLength={6}
              placeholder="Минимум 6 символов"
            />
          </div>
          <div>
            <label className="label">Роль</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  form.role === 'participant'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                onClick={() => setForm(p => ({ ...p, role: 'participant' }))}
              >
                <div className="font-bold">🎮 Участник</div>
                <div className="text-xs mt-1">Прохожу квизы</div>
              </button>
              <button
                type="button"
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  form.role === 'organizer'
                    ? 'border-accent-500 bg-accent-50 text-accent-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                onClick={() => setForm(p => ({ ...p, role: 'organizer' }))}
              >
                <div className="font-bold">🎤 Организатор</div>
                <div className="text-xs mt-1">Создаю квизы</div>
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full !py-3" disabled={submitting}>
            {submitting ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}

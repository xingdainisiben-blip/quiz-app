import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Вход в аккаунт</h1>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="••••••"
            />
          </div>
          <button type="submit" className="btn-primary w-full !py-3" disabled={submitting}>
            {submitting ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}

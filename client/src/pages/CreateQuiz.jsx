import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizzes as quizzesApi } from '../lib/api';

const CATEGORIES = [
  'general', 'science', 'history', 'geography', 'sport',
  'music', 'movies', 'technology', 'literature', 'art',
];

export default function CreateQuiz() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'general',
    time_per_question: 30,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('Введите название квиза');
      return;
    }
    setSubmitting(true);
    try {
      const data = await quizzesApi.create(form);
      navigate(`/quiz/${data.quiz.id}/edit`);
    } catch (err) {
      setError(err.message || 'Ошибка создания');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Создание квиза</h1>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label className="label">Название квиза *</label>
          <input
            type="text"
            className="input"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            required
            maxLength={200}
            placeholder="Например: История России XX века"
          />
        </div>

        <div>
          <label className="label">Описание</label>
          <textarea
            className="input"
            rows={3}
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            maxLength={1000}
            placeholder="Краткое описание квиза..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Категория</label>
            <select
              className="input"
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Время на вопрос (сек)</label>
            <input
              type="number"
              className="input"
              value={form.time_per_question}
              onChange={e => setForm(p => ({ ...p, time_per_question: parseInt(e.target.value) || 30 }))}
              min={5}
              max={300}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1 !py-3" disabled={submitting}>
            {submitting ? 'Создание...' : 'Создать и добавить вопросы'}
          </button>
          <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary !py-3">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}

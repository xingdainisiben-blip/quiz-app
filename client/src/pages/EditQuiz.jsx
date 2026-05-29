import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { quizzes as quizzesApi } from '../lib/api';

const QUESTION_TYPES = [
  { value: 'text_single', label: 'Текст, один ответ' },
  { value: 'text_multiple', label: 'Текст, несколько ответов' },
  { value: 'image_single', label: 'Картинка, один ответ' },
  { value: 'image_multiple', label: 'Картинка, несколько ответов' },
];

const emptyOption = () => ({ text: '', is_correct: false });

function QuestionForm({ question, index, onSave, onDelete, onCancel }) {
  const isNew = !question.id;
  const [form, setForm] = useState({
    type: question.type || 'text_single',
    text: question.text || '',
    image_url: question.image_url || '',
    time_limit: question.time_limit || '',
    points: question.points || 100,
    options: question.options?.length ? question.options.map(o => ({ text: o.text, is_correct: !!o.is_correct })) : [emptyOption(), emptyOption()],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addOption = () => {
    if (form.options.length >= 6) return;
    setForm(p => ({ ...p, options: [...p.options, emptyOption()] }));
  };

  const removeOption = (i) => {
    if (form.options.length <= 2) return;
    setForm(p => ({ ...p, options: p.options.filter((_, idx) => idx !== i) }));
  };

  const updateOption = (i, field, value) => {
    setForm(p => ({
      ...p,
      options: p.options.map((o, idx) => idx === i ? { ...o, [field]: value } : o),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.text.trim()) { setError('Введите текст вопроса'); return; }
    const hasCorrect = form.options.some(o => o.is_correct);
    if (!hasCorrect) { setError('Отметьте хотя бы один правильный ответ'); return; }
    if (form.type.endsWith('single') && form.options.filter(o => o.is_correct).length > 1) {
      setError('В режиме одного ответа должен быть только один правильный вариант'); return;
    }
    if (form.type.startsWith('image_') && !form.image_url.trim()) {
      setError('Добавьте URL изображения для вопроса с картинкой'); return;
    }

    setSaving(true);
    try {
      await onSave(form, question.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card border-2 border-primary-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">
          {isNew ? 'Новый вопрос' : `Вопрос ${index + 1}`}
        </h3>
        {!isNew && (
          <button type="button" onClick={() => onDelete(question.id)} className="btn-danger text-sm !py-1">
            Удалить
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg mb-4 text-sm">{error}</div>}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Тип вопроса</label>
            <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Баллы</label>
            <input type="number" className="input" value={form.points} onChange={e => setForm(p => ({ ...p, points: parseInt(e.target.value) || 100 }))} min={10} max={1000} />
          </div>
        </div>

        <div>
          <label className="label">Текст вопроса</label>
          <textarea className="input" rows={2} value={form.text} onChange={e => setForm(p => ({ ...p, text: e.target.value }))} placeholder="Введите вопрос..." />
        </div>

        {form.type.startsWith('image_') && (
          <div>
            <label className="label">URL изображения</label>
            <input type="url" className="input" value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} placeholder="https://example.com/image.jpg" />
            {form.image_url && (
              <img src={form.image_url} alt="Preview" className="mt-2 max-h-40 rounded-lg" onError={e => e.target.style.display = 'none'} />
            )}
          </div>
        )}

        <div>
          <label className="label">Время (сек, пусто = по умолчанию)</label>
          <input type="number" className="input w-32" value={form.time_limit} onChange={e => setForm(p => ({ ...p, time_limit: e.target.value }))} min={5} max={300} placeholder="30" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label !mb-0">Варианты ответа</label>
            {form.options.length < 6 && (
              <button type="button" onClick={addOption} className="text-sm text-primary-600 hover:text-primary-700">+ Добавить</button>
            )}
          </div>
          <div className="space-y-2">
            {form.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type={form.type.endsWith('single') ? 'radio' : 'checkbox'}
                  name="correct_option"
                  checked={opt.is_correct}
                  onChange={e => updateOption(i, 'is_correct', e.target.checked)}
                  className="w-4 h-4 text-primary-600"
                />
                <input
                  type="text"
                  className="input flex-1"
                  value={opt.text}
                  onChange={e => updateOption(i, 'text', e.target.value)}
                  placeholder={`Вариант ${i + 1}`}
                />
                {form.options.length > 2 && (
                  <button type="button" onClick={() => removeOption(i)} className="text-red-500 hover:text-red-700 text-lg leading-none px-1">&times;</button>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {form.type.endsWith('single') ? 'Выберите один правильный ответ (radio)' : 'Выберите один или несколько правильных ответов (checkbox)'}
          </p>
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Сохранение...' : isNew ? 'Добавить вопрос' : 'Сохранить'}
        </button>
        {!isNew && <button type="button" onClick={onCancel} className="btn-secondary">Отмена</button>}
      </div>
    </form>
  );
}

export default function EditQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);

  const loadQuiz = useCallback(async () => {
    try {
      const data = await quizzesApi.get(id);
      setQuiz(data.quiz);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  const handleSaveQuestion = async (form, questionId) => {
    if (questionId) {
      await quizzesApi.updateQuestion(quiz.id, questionId, form);
    } else {
      await quizzesApi.addQuestion(quiz.id, form);
    }
    setShowNewQuestion(false);
    setEditingQuestionId(null);
    await loadQuiz();
  };

  const handleDeleteQuestion = async (qid) => {
    if (!confirm('Удалить этот вопрос?')) return;
    await quizzesApi.deleteQuestion(quiz.id, qid);
    await loadQuiz();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Ошибка загрузки</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const questions = quiz.questions || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{quiz.title}</h1>
          <p className="text-gray-600 mt-1">
            Вопросов: {questions.length} · {quiz.time_per_question}с/вопрос · {quiz.category}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate(`/quiz/${quiz.id}/lobby`)} className="btn-accent" disabled={questions.length === 0}>
            ▶️ Запустить
          </button>
          <Link to="/dashboard" className="btn-secondary">Назад</Link>
        </div>
      </div>

      {/* Existing questions */}
      {questions.map((q, i) => (
        <div key={q.id} className="mb-4">
          {editingQuestionId === q.id ? (
            <QuestionForm
              question={q}
              index={i}
              onSave={handleSaveQuestion}
              onDelete={handleDeleteQuestion}
              onCancel={() => setEditingQuestionId(null)}
            />
          ) : (
            <div className="card flex items-start justify-between hover:shadow-md transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-blue">№{i + 1}</span>
                  <span className="badge-gray">{QUESTION_TYPES.find(t => t.value === q.type)?.label || q.type}</span>
                  <span className="text-sm text-gray-500">{q.points} бал.</span>
                </div>
                <p className="font-medium">{q.text}</p>
                {q.image_url && <img src={q.image_url} alt="" className="mt-2 max-h-32 rounded" />}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {q.options?.map(o => (
                    <span key={o.id} className={`text-xs px-2 py-0.5 rounded ${o.is_correct ? 'bg-green-100 text-green-800 font-medium' : 'bg-gray-100 text-gray-600'}`}>
                      {o.text}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => setEditingQuestionId(q.id)} className="btn-secondary text-sm !py-1 ml-4 flex-shrink-0">
                ✏️
              </button>
            </div>
          )}
        </div>
      ))}

      {/* New question form */}
      {showNewQuestion ? (
        <div className="mb-4">
          <QuestionForm
            question={{}}
            index={questions.length}
            onSave={handleSaveQuestion}
            onDelete={() => {}}
            onCancel={() => setShowNewQuestion(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => { setShowNewQuestion(true); setEditingQuestionId(null); }}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
        >
          + Добавить вопрос
        </button>
      )}
    </div>
  );
}

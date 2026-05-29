import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-accent-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl font-bold mb-6 animate-slide-up">
            Создавайте и проходите квизы в реальном времени
          </h1>
          <p className="text-xl text-primary-100 mb-10 max-w-2xl mx-auto">
            QuizMaster — платформа для интерактивных опросов. Создайте квиз за минуты,
            пригласите участников по коду комнаты и смотрите результаты в реальном времени.
          </p>
          <div className="flex gap-4 justify-center">
            {user ? (
              <>
                {user.role === 'organizer' && (
                  <Link to="/quiz/create" className="bg-white text-primary-700 px-8 py-3 rounded-lg font-bold text-lg hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl">
                    Создать квиз
                  </Link>
                )}
                <Link to="/join" className="border-2 border-white text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-white/10 transition-all">
                  Присоединиться
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="bg-white text-primary-700 px-8 py-3 rounded-lg font-bold text-lg hover:bg-primary-50 transition-all shadow-lg">
                  Начать бесплатно
                </Link>
                <Link to="/login" className="border-2 border-white text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-white/10 transition-all">
                  Войти
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Возможности платформы</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: '📝',
              title: 'Разные типы вопросов',
              desc: 'Текстовые и с изображениями, с одиночным и множественным выбором ответа.',
            },
            {
              icon: '⚡',
              title: 'Реальное время',
              desc: 'Вопросы отображаются синхронно у всех участников. Ответы принимаются только во время демонстрации.',
            },
            {
              icon: '🏆',
              title: 'Мгновенные результаты',
              desc: 'Автоматический подсчёт баллов и таблица лидеров после каждого вопроса и в конце квиза.',
            },
            {
              icon: '🔑',
              title: 'Код комнаты',
              desc: 'Участники подключаются по 6-значному коду. Никаких ссылок и сложных приглашений.',
            },
            {
              icon: '📊',
              title: 'Статистика',
              desc: 'История участий и проведённых квизов в личном кабинете.',
            },
            {
              icon: '🎨',
              title: 'Современный дизайн',
              desc: 'Адаптивный интерфейс, удобный на любых устройствах.',
            },
          ].map((f, i) => (
            <div key={i} className="card text-center hover:shadow-md transition-shadow">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-100 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Как это работает</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Создайте квиз', desc: 'Добавьте вопросы и настройте параметры' },
              { step: '2', title: 'Запустите сессию', desc: 'Получите код комнаты для участников' },
              { step: '3', title: 'Пригласите игроков', desc: 'Участники вводят код и подключаются' },
              { step: '4', title: 'Смотрите результаты', desc: 'Автоматический подсчёт и лидерборд' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

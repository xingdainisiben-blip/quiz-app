import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary-700">
          <span className="text-2xl">🎯</span>
          QuizMaster
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link to="/dashboard" className="text-gray-600 hover:text-primary-600 transition-colors">
                Мои квизы
              </Link>
              {user.role === 'organizer' && (
                <Link to="/quiz/create" className="btn-primary text-sm !py-1.5 !px-3">
                  + Создать
                </Link>
              )}
              <Link to="/join" className="btn-outline text-sm !py-1.5 !px-3">
                Присоединиться
              </Link>

              <div className="relative group">
                <button className="flex items-center gap-2 text-gray-700 hover:text-primary-600 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                    {user.username[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:inline">{user.username}</span>
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-48 hidden group-hover:block">
                  <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    👤 Профиль
                  </Link>
                  <hr className="my-1" />
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    🚪 Выйти
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="text-gray-600 hover:text-primary-600 transition-colors">
                Войти
              </Link>
              <Link to="/register" className="btn-primary text-sm !py-1.5 !px-4">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

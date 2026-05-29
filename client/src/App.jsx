import { Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateQuiz from './pages/CreateQuiz';
import EditQuiz from './pages/EditQuiz';
import QuizLobby from './pages/QuizLobby';
import JoinQuiz from './pages/JoinQuiz';
import PlayerRoom from './pages/PlayerRoom';
import Profile from './pages/Profile';

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="quiz/create" element={<CreateQuiz />} />
          <Route path="quiz/:id/edit" element={<EditQuiz />} />
          <Route path="quiz/:id/lobby" element={<QuizLobby />} />
          <Route path="join" element={<JoinQuiz />} />
          <Route path="play/:roomCode" element={<PlayerRoom />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>
    </Routes>
  );
}

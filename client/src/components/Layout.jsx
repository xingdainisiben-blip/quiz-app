import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-white border-t border-gray-200 py-4 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          QuizMaster © 2026 — Интерактивная платформа для квизов
        </div>
      </footer>
    </div>
  );
}

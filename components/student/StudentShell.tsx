/**
 * P0 (2026-07-12 nav audit) — StudentShell
 *
 * Standalone chrome for the student-facing surface. Replaces the full teacher
 * Sidebar/BottomNavBar (which leaked "AI Generator," "Scenario Bank," a
 * "Кредити N — Pro" billing widget, and a teacher Sign Out button onto every
 * student screen) with a minimal top bar: brand mark, language switcher, a
 * home shortcut, and a student-appropriate logout.
 */
import React from 'react';
import { signOut } from 'firebase/auth';
import { Home, LogOut } from 'lucide-react';
import { auth } from '../../firebaseConfig';
import { useLanguage } from '../../i18n/LanguageContext';
import { useNavigation } from '../../contexts/NavigationContext';
import type { Language } from '../../i18n';

interface StudentShellProps {
  path: string;
  children: React.ReactNode;
}

export const StudentShell: React.FC<StudentShellProps> = ({ path, children }) => {
  const { language, setLanguage } = useLanguage();
  const { navigate } = useNavigation();

  const isLogin = path === '/student/login';
  const isDashboard = path === '/student';

  const handleLogout = async () => {
    try { await signOut(auth); } catch { /* ignore */ }
    try {
      localStorage.removeItem('studentName');
      localStorage.removeItem('student_google_uid');
    } catch { /* ignore */ }
    navigate('/student/login');
  };

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b px-4 py-2.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/student')}
          className="flex items-center gap-2 font-bold text-brand-primary"
          aria-label="MisMath — почетна страница"
        >
          <span className="text-lg" aria-hidden="true">📐</span>
          <span className="hidden sm:inline">MisMath</span>
        </button>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            aria-label="Избери јазик на интерфејсот"
            className="text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md py-1.5 px-2"
          >
            <option value="mk">🇲🇰 МК</option>
            <option value="sq">🇦🇱 SQ</option>
            <option value="tr">🇹🇷 TR</option>
          </select>
          {!isDashboard && !isLogin && (
            <button
              type="button"
              onClick={() => navigate('/student')}
              className="p-2 text-gray-500 hover:text-brand-primary"
              aria-label="Почетна"
            >
              <Home className="w-4 h-4" />
            </button>
          )}
          {!isLogin && (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 border border-gray-200 rounded-md"
              aria-label="Одјави се"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Одјави се</span>
            </button>
          )}
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

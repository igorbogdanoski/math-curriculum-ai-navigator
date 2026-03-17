import React from 'react';
import { useRouter } from '../../hooks/useRouter';
import { 
  LayoutDashboard, 
  Settings, 
  Calendar, 
  Menu,
  X,
  LogOut 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SilentErrorBoundary } from '../common/SilentErrorBoundary'; // ОВА Е ЛИНИЈАТА ШТО ФАЛЕШЕ

export const Layout = () => {
  const { user, firebaseUser, logout } = useAuth();
  const { path, navigate } = useRouter([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navigation = [
    { name: 'Преглед', href: '/', icon: LayoutDashboard },
    { name: 'Планер', href: '/planner', icon: Calendar },
    // Можеш да додадеш други рути тука
    { name: 'Подесувања', href: '/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/' && path !== '/') return false;
    return path.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar за Десктоп */}
      <div className="hidden md:flex flex-col w-64 bg-slate-900 text-white fixed h-full z-10">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-xl">
            AI
          </div>
          <span className="font-bold text-lg tracking-tight">Navigator</span>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.name}
                href={`#${item.href}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive(item.href)
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </a>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
              {firebaseUser?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{firebaseUser?.email}</p>
            </div>
            <button onClick={logout} className="text-slate-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Главен дел */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Мобилен Хедер */}
        <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-20">
          <span className="font-bold text-lg">AI Navigator</span>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Мобилно Мени */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-slate-800 text-white p-4 absolute top-16 w-full z-20 shadow-xl">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={`#${item.href}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 p-3 border-b border-slate-700 last:border-0"
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </a>
            ))}
          </div>
        )}

        {/* Содржина завиткана во ErrorBoundary */}
        <main className="flex-1">
            <SilentErrorBoundary>
                {null}
            </SilentErrorBoundary>
        </main>
      </div>
    </div>
  );
};

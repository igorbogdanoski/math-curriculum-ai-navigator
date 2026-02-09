import React from 'react';
import { APP_NAME, ICONS } from '../constants';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';

interface SidebarProps {
  currentPath: string;
  isOpen: boolean;
  onClose: () => void;
}

const NavItem: React.FC<{
  path: string;
  currentPath: string;
  icon: React.ComponentType<{className?: string}>;
  label: string;
  onClick: () => void;
  isGenerator?: boolean;
}> = ({ path, currentPath, icon: Icon, label, onClick, isGenerator = false }) => {
  const { navigate } = useNavigation();
  const { openGeneratorPanel } = useGeneratorPanel();
  const isActive = currentPath === path || (path !== '/' && currentPath.startsWith(path));
  const activeClasses = 'bg-blue-100 text-brand-primary font-semibold';
  const inactiveClasses = 'text-gray-600 hover:bg-blue-50 hover:text-brand-primary';

  return (
    <a
      href={`#${path}`}
      onClick={(e) => {
        e.preventDefault();
        if (isGenerator) {
          openGeneratorPanel({});
        } else {
          navigate(path);
        }
        onClick();
      }}
      className={`flex items-center px-4 py-3 my-1 rounded-lg transition-colors duration-200 ${
        isActive && !isGenerator ? activeClasses : inactiveClasses
      }`}
    >
      <Icon className="w-5 h-5 mr-3" />
      <span className="font-medium">{label}</span>
    </a>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, isOpen, onClose }) => {
    const { user, logout } = useAuth();
  return (
    <aside className={`w-64 bg-white text-gray-800 flex flex-col h-screen fixed shadow-2xl z-30 no-print transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 border-r border-gray-100`}>
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h1 className="text-xl font-bold text-brand-primary truncate" title={APP_NAME}>{APP_NAME}</h1>
        {/* Mobile Close Button - Essential for stability on small screens */}
        <button 
          onClick={onClose} 
          className="md:hidden p-1 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Close Sidebar"
        >
          <ICONS.close className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        <NavItem path="/" currentPath={currentPath} icon={ICONS.home} label="Почетна" onClick={onClose} />
        <NavItem path="/explore" currentPath={currentPath} icon={ICONS.bookOpen} label="Истражи програма" onClick={onClose} />
        <NavItem path="/graph" currentPath={currentPath} icon={ICONS.share} label="Интерактивен Граф" onClick={onClose} />
        <NavItem path="/roadmap" currentPath={currentPath} icon={ICONS.mindmap} label="Патна Мапа" onClick={onClose} />
        <NavItem path="/planner" currentPath={currentPath} icon={ICONS.planner} label="Планер" onClick={onClose} />
        <hr className="my-2 border-gray-200"/>
        <h2 className="px-4 pt-4 pb-1 text-xs font-bold text-gray-400 uppercase tracking-widest">AI Алатки</h2>
        <NavItem path="/assistant" currentPath={currentPath} icon={ICONS.assistant} label="AI Асистент" onClick={onClose} />
        <NavItem path="/generator" currentPath={currentPath} icon={ICONS.generator} label="Генератор" onClick={onClose} isGenerator={true} />
        <NavItem path="/reports/coverage" currentPath={currentPath} icon={ICONS.chart} label="Анализа на Покриеност" onClick={onClose} />
        <hr className="my-2 border-gray-200"/>
        <h2 className="px-4 pt-4 pb-1 text-xs font-bold text-gray-400 uppercase tracking-widest">Ресурси</h2>
        <NavItem path="/my-lessons" currentPath={currentPath} icon={ICONS.myLessons} label="Мои подготовки" onClick={onClose} />
        <NavItem path="/favorites" currentPath={currentPath} icon={ICONS.star} label="Омилени" onClick={onClose} />
        <NavItem path="/gallery" currentPath={currentPath} icon={ICONS.gallery} label="Галерија на Заедницата" onClick={onClose} />
        <NavItem path="/settings" currentPath={currentPath} icon={ICONS.settings} label="Поставки" onClick={onClose} />
      </nav>
      <div className="p-2 border-t bg-gray-50/50">
        <div className="rounded-lg p-2 hover:bg-gray-100 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
                {user?.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-brand-secondary text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        {user?.name?.charAt(0) || '?'}
                    </div>
                )}
                <div className="overflow-hidden">
                    <p className="font-semibold text-sm text-brand-text truncate">{user?.name || 'Корисник'}</p>
                    <button onClick={logout} className="text-xs text-gray-500 hover:text-brand-primary transition-colors">Одјави се</button>
                </div>
            </div>
        </div>
      </div>
    </aside>
  );
};
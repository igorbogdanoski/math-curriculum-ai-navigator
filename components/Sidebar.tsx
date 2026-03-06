import { LANGUAGES } from '../i18n';
import { useLanguage } from '../i18n/LanguageContext';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { APP_NAME, ICONS } from '../constants';
import { LanguageSelector } from './common/LanguageSelector';
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
  badge?: string;
}> = ({ path, currentPath, icon: Icon, label, onClick, isGenerator = false, badge }) => {
  const { navigate } = useNavigation();
  const { t, language, setLanguage } = useLanguage();
  const { openGeneratorPanel } = useGeneratorPanel();
  const isActive = currentPath === path || (path !== '/' && currentPath.startsWith(path));
  const activeClasses = 'bg-brand-primary text-white font-semibold shadow-sm';
  const inactiveClasses = 'text-gray-600 hover:bg-blue-50 hover:text-brand-primary';

  return (
    <a
      href={`#${path}`}
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        if (isGenerator) {
          openGeneratorPanel({});
        } else {
          navigate(path);
        }
        onClick();
      }}
      className={`flex items-center px-4 py-2.5 my-0.5 rounded-lg transition-colors duration-150 ${
        isActive && !isGenerator ? activeClasses : inactiveClasses
      }`}
    >
      <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
      <span className="font-medium truncate flex-1">{label}</span>
      {badge && (
        <span className="ml-1 text-[10px] font-bold bg-brand-accent/20 text-brand-accent px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </a>
  );
};
  import { InstallPWAButton } from './common/InstallPWAButton';
export const Sidebar: React.FC<SidebarProps> = ({ currentPath, isOpen, onClose }) => {
  const { t, language, setLanguage } = useLanguage();
    const { user, logout } = useAuth();
    const { navigate } = useNavigation();

    // Progressive disclosure â€” secondary nav collapsed by default
    const [showMore, setShowMore] = useState(() => {
      const secondaryPaths = ['/explore', '/graph', '/roadmap', '/assistant',
        '/test-generator', '/reports/coverage', '/favorites', '/gallery'];
      return secondaryPaths.some(p => currentPath === p || currentPath.startsWith(p));
    });

  return (
    <aside className={`w-64 bg-white text-gray-800 flex flex-col h-screen fixed shadow-2xl z-30 no-print transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 border-r border-gray-100`}>
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h1 className="text-xl font-bold text-brand-primary truncate" title={APP_NAME}>{APP_NAME}</h1>
        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Затвори странична лента"
        >
          <ICONS.close className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar" aria-label="Главна навигација">
        {/* ── PRIMARY NAV (always visible) ── */}
        <div className="space-y-0.5">
          <NavItem path="/" currentPath={currentPath} icon={ICONS.home} label={t("nav.home")} onClick={onClose} />
          <NavItem path="/generator" currentPath={currentPath} icon={ICONS.generator} label={t("nav.generator")} onClick={onClose} isGenerator={true} badge="AI" />
          <NavItem path="/planner" currentPath={currentPath} icon={ICONS.planner} label={t("nav.planner")} onClick={onClose} />
          <NavItem path="/analytics" currentPath={currentPath} icon={ICONS.analytics} label={t("nav.analytics")} onClick={onClose} />
          <NavItem path="/my-lessons" currentPath={currentPath} icon={ICONS.myLessons} label={t("nav.mylessons")} onClick={onClose} />
          <NavItem path="/library" currentPath={currentPath} icon={ICONS.bookOpen} label={t("nav.library")} onClick={onClose} />            
          {(user?.role === 'school_admin' || user?.role === 'admin') && (
              <>
                <NavItem path="/school-admin" currentPath={currentPath} icon={ICONS.school} label={t("nav.schooladmin")} onClick={onClose} />
                <NavItem path="/reviews" currentPath={currentPath} icon={ICONS.shieldCheck} label="Рецензии" onClick={onClose} />
              </>
            )}          
          {user?.role === 'admin' && (
              <NavItem path="/system-admin" currentPath={currentPath} icon={ICONS.shieldAlert} label="Училишта" onClick={onClose} />
          )}
          <NavItem path="/settings" currentPath={currentPath} icon={ICONS.settings} label={t("nav.settings")} onClick={onClose} />
        </div>

        {/* ── SECONDARY NAV (collapsible) ── */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50"
          >
            <span>{showMore ? 'Помалку' : 'Повеќе алатки'}</span>
            {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showMore && (
            <div className="mt-1 space-y-0.5 animate-fade-in">
              <hr className="mb-2 border-gray-100" />
              <p className="px-4 pb-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">Истражи</p>
              <NavItem path="/explore" currentPath={currentPath} icon={ICONS.bookOpen} label={t("nav.explore")} onClick={onClose} />
              <NavItem path="/graph" currentPath={currentPath} icon={ICONS.share} label={t("nav.graph")} onClick={onClose} />
              <NavItem path="/roadmap" currentPath={currentPath} icon={ICONS.mindmap} label={t("nav.roadmap")} onClick={onClose} />
              <hr className="my-2 border-gray-100" />
              <p className="px-4 pb-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">AI Алатки</p>
              <NavItem path="/assistant" currentPath={currentPath} icon={ICONS.assistant} label={t("nav.assistant")} onClick={onClose} />
              <NavItem path="/test-generator" currentPath={currentPath} icon={ICONS.assessment} label={t("nav.testgenerator")} onClick={onClose} />
              <NavItem path="/reports/coverage" currentPath={currentPath} icon={ICONS.chart} label={t("nav.coverage")} onClick={onClose} />
              <hr className="my-2 border-gray-100" />
              <p className="px-4 pb-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">Ресурси</p>
              <NavItem path="/favorites" currentPath={currentPath} icon={ICONS.star} label={t("nav.favorites")} onClick={onClose} />
              <NavItem path="/gallery" currentPath={currentPath} icon={ICONS.gallery} label={t("nav.gallery")} onClick={onClose} />
              <NavItem path="/national-library" currentPath={currentPath} icon={ICONS.bookOpen} label={t("nav.nationalLibrary")} onClick={onClose} />
            </div>
          )}
        </div>
      </nav>
      <div className="p-2 border-t bg-gray-50/50 space-y-2">
        <div className="px-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="w-full text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary py-1.5 px-2"
            >
              <option value="mk">🇲🇰 Македонски</option>
              <option value="sq">🇦🇱 Shqip</option>
              <option value="tr">🇹🇷 Türkçe</option>
            </select>
        </div>
            <InstallPWAButton />
        <div 
          onClick={() => {
            navigate('/settings');
            onClose();
          }}
          className="rounded-lg p-2 hover:bg-gray-100 transition-colors cursor-pointer group"
        >
            <div className="flex items-center gap-3">
                {user?.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-brand-secondary text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        {user?.name?.charAt(0) || '?'}
                    </div>
                )}
                <div className="overflow-hidden">
                    <p className="font-semibold text-sm text-brand-text truncate">{user?.name || t('dashboard_default_user')}</p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        logout();
                      }} 
                      className="text-xs text-gray-500 hover:text-brand-primary transition-colors"
                    >
                      {t('sidebar_logout')}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </aside>
  );
};


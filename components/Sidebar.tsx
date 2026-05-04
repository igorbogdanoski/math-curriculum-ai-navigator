import { LANGUAGES } from '../i18n';
import { useLanguage } from '../i18n/LanguageContext';
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { trackEvent } from '../services/telemetryService';
import { APP_NAME, ICONS } from '../constants';
import { LanguageSelector } from './common/LanguageSelector';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { useForumUnreadCount } from '../hooks/useForumUnreadCount';
import { useMaturaMissions } from '../hooks/useMaturaMissions';

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
  unreadCount?: number;
}> = ({ path, currentPath, icon: Icon, label, onClick, isGenerator = false, badge, unreadCount }) => {
  const { navigate } = useNavigation();
  const { t, language, setLanguage } = useLanguage();
  const { openGeneratorPanel } = useGeneratorPanel();
  const isActive = currentPath === path || (path !== '/' && currentPath.startsWith(path));
  const activeClasses = 'bg-brand-primary text-white font-semibold shadow-md';
  const inactiveClasses = 'text-gray-600 hover:bg-blue-50 hover:text-brand-primary hover:translate-x-1';

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
      className={`flex items-center px-4 py-2.5 my-0.5 rounded-lg transition-all duration-200 ${
        isActive && !isGenerator ? activeClasses : inactiveClasses
      }`}
    >
      <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
      <span className="font-medium truncate flex-1">{label}</span>
      {unreadCount != null && unreadCount > 0 && (
        <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-black bg-rose-500 text-white px-1 rounded-full animate-pulse">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
      {!unreadCount && badge && (
        <span className="ml-1 text-[10px] font-bold bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </a>
  );
};
  import { InstallPWAButton } from './common/InstallPWAButton';
export const Sidebar: React.FC<SidebarProps> = ({ currentPath, isOpen, onClose }) => {
  const { t, language, setLanguage } = useLanguage();
    const { user, logout, firebaseUser } = useAuth();
    const { navigate } = useNavigation();
    const forumUnread = useForumUnreadCount(firebaseUser?.uid ?? null);
    const { mission, streakLabel } = useMaturaMissions();

    // S39-F4: emit quota_warning_seen once per session when balance is at or below threshold
    const quotaWarningEmittedRef = useRef(false);
    useEffect(() => {
        if (quotaWarningEmittedRef.current) return;
        if (user?.isPremium || user?.hasUnlimitedCredits || user?.role === 'admin') return;
        const balance = user?.aiCreditsBalance;
        if (typeof balance !== 'number') return;
        if (balance > 10 || balance < 0) return;
        quotaWarningEmittedRef.current = true;
        trackEvent('quota_warning_seen', { balance, source: 'sidebar_meter', threshold: 10 });
    }, [user?.aiCreditsBalance, user?.isPremium, user?.hasUnlimitedCredits, user?.role]);

    // Progressive disclosure â€” secondary nav collapsed by default, auto-opens when on a secondary path
    const [showMore, setShowMore] = useState(() => {
      const secondaryPaths = [
        '/explore', '/graph', '/roadmap',
        '/planner', '/annual-planner', '/annual-gallery',
        '/assistant', '/vision-assessment', '/test-generator', '/grade-book',
        '/matura', '/matura-library', '/matura-practice', '/matura-stats', '/test-review', '/live', '/data-viz', '/kahoot',
        '/academy', '/my-profile', '/my-progress', '/portfolio',
        '/national-library', '/gallery', '/favorites', '/reports/coverage',
      ];
      return secondaryPaths.some(p => currentPath === p || currentPath.startsWith(p));
    });

  return (
    <aside className={`w-64 bg-white text-gray-800 flex flex-col h-screen fixed shadow-2xl z-30 no-print transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 border-r border-gray-100`}>
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h1 className="text-xl font-bold text-brand-primary truncate" title={APP_NAME}>{APP_NAME}</h1>
        {/* Mobile Close Button */}
        <button type="button"
          onClick={onClose}
          className="md:hidden p-1 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Ð—Ð°Ñ‚Ð²Ð¾Ñ€Ð¸ ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ‡Ð½Ð° Ð»ÐµÐ½Ñ‚Ð°"
        >
          <ICONS.close className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar" aria-label="Ð“Ð»Ð°Ð²Ð½Ð° Ð½Ð°Ð²Ð¸Ð³Ð°Ñ†Ð¸Ñ˜Ð°">
        {/* â”€â”€ PRIMARY NAV (7 core items, always visible) â”€â”€ */}
        <div className="space-y-0.5">
          <NavItem path="/" currentPath={currentPath} icon={ICONS.home} label={t("nav.home")} onClick={onClose} />
          <NavItem path="/generator" currentPath={currentPath} icon={ICONS.generator} label={t("nav.generator")} onClick={onClose} isGenerator={true} badge="AI" />
          <NavItem path="/my-lessons" currentPath={currentPath} icon={ICONS.myLessons} label={t("nav.mylessons")} onClick={onClose} />
          <NavItem path="/analytics" currentPath={currentPath} icon={ICONS.analytics} label={t("nav.analytics")} onClick={onClose} />
          <NavItem path="/library" currentPath={currentPath} icon={ICONS.bookOpen} label={t("nav.library")} onClick={onClose} />
          <NavItem path="/forum" currentPath={currentPath} icon={ICONS.chatBubble} label={t("nav.forum")} onClick={onClose} badge="CoP" unreadCount={forumUnread} />
          {(user?.role === 'school_admin' || user?.role === 'admin') && (
            <>
              <NavItem path="/school-admin" currentPath={currentPath} icon={ICONS.school} label={t("nav.schooladmin")} onClick={onClose} />
              <NavItem path="/school-admin/curriculum" currentPath={currentPath} icon={ICONS.bookOpen} label={t("nav.editCurriculum")} onClick={onClose} badge="NEW" />
              <NavItem path="/reviews" currentPath={currentPath} icon={ICONS.shieldCheck} label={t("nav.reviews")} onClick={onClose} />
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <NavItem path="/system-admin" currentPath={currentPath} icon={ICONS.shieldAlert} label={t("nav.schools")} onClick={onClose} />
              <NavItem path="/slo" currentPath={currentPath} icon={ICONS.activity} label="SLO Dashboard" onClick={onClose} badge="OPS" />
            </>
          )}
          <NavItem path="/settings" currentPath={currentPath} icon={ICONS.settings} label={t("nav.settings")} onClick={onClose} />
        </div>

        {/* â”€â”€ SECONDARY NAV (collapsible, grouped) â”€â”€ */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-gray-600 uppercase tracking-widest hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-50"
          >
            <span>{showMore ? t('sidebar.less') : t('sidebar.moreTools')}</span>
            {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showMore && (
            <div className="mt-1 space-y-0.5 animate-fade-in">
              {/* ÐŸÐ»Ð°Ð½Ð¸Ñ€Ð°ÑšÐµ */}
              <hr className="mb-2 border-gray-100" />
              <p className="px-4 pb-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">{t('sidebar.sec.planning')}</p>
              <NavItem path="/planner" currentPath={currentPath} icon={ICONS.planner} label={t("nav.planner")} onClick={onClose} />
              <NavItem path="/annual-planner" currentPath={currentPath} icon={ICONS.planner} label="Ð“Ð¾Ð´Ð¸ÑˆÐ½Ð° ÐŸÑ€Ð¾Ð³Ñ€Ð°Ð¼Ð°" onClick={onClose} badge="AI" />
              <NavItem path="/annual-gallery" currentPath={currentPath} icon={ICONS.database} label="Ð“Ð°Ð»ÐµÑ€Ð¸Ñ˜Ð° Ð½Ð° ÐŸÐ»Ð°Ð½Ð¾Ð²Ð¸" onClick={onClose} badge="CoM" />

              {/* Ð˜ÑÑ‚Ñ€Ð°Ð¶Ð¸ ÐŸÑ€Ð¾Ð³Ñ€Ð°Ð¼Ð° */}
              <hr className="my-2 border-gray-100" />
              <p className="px-4 pb-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">{t('sidebar.sec.programme')}</p>
              <NavItem path="/explore" currentPath={currentPath} icon={ICONS.bookOpen} label={t("nav.explore")} onClick={onClose} />
              <NavItem path="/graph" currentPath={currentPath} icon={ICONS.share} label={t("nav.graph")} onClick={onClose} />
              <NavItem path="/roadmap" currentPath={currentPath} icon={ICONS.mindmap} label={t("nav.roadmap")} onClick={onClose} />

              {/* AI ÐÐ»Ð°Ñ‚ÐºÐ¸ */}
              <hr className="my-2 border-gray-100" />
              <p className="px-4 pb-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">{t('sidebar.sec.aitools')}</p>
              <NavItem path="/assistant" currentPath={currentPath} icon={ICONS.assistant} label={t("nav.assistant")} onClick={onClose} />
              <NavItem path="/vision-assessment" currentPath={currentPath} icon={ICONS.camera} label={t("nav.visionAssessment")} onClick={onClose} badge="NEW" />
              <NavItem path="/test-generator" currentPath={currentPath} icon={ICONS.assessment} label={t("nav.testgenerator")} onClick={onClose} />
              <NavItem path="/grade-book" currentPath={currentPath} icon={ICONS.gradeBook} label="Ð¢ÐµÑ‚Ñ€Ð°Ñ‚ÐºÐ° Ð·Ð° Ð¾Ñ†ÐµÐ½ÐºÐ¸" onClick={onClose} badge="NEW" />
              <NavItem path="/matura-library" currentPath={currentPath} icon={ICONS.education} label="Ð‘Ð¸Ð±Ð»Ð¸Ð¾Ñ‚ÐµÐºÐ° Ð¼Ð°Ñ‚ÑƒÑ€Ð°" onClick={onClose} badge="Ð”Ð˜Ðœ" />
              <NavItem path="/matura-practice" currentPath={currentPath} icon={ICONS.assessment} label="ÐŸÑ€Ð°ÐºÑ‚Ð¸ÐºÐ° Ð¼Ð°Ñ‚ÑƒÑ€Ð°" onClick={onClose} badge="AI" />
              <NavItem path="/matura" currentPath={currentPath} icon={ICONS.assessment} label="Ð¡Ð¸Ð¼ÑƒÐ»Ð°Ñ†Ð¸Ñ˜Ð° Ð¼Ð°Ñ‚ÑƒÑ€Ð°" onClick={onClose} />
              <NavItem path="/matura-stats" currentPath={currentPath} icon={ICONS.analytics} label="ÐÐ½Ð°Ð»Ð¸Ñ‚Ð¸ÐºÐ° Ð¼Ð°Ñ‚ÑƒÑ€Ð°" onClick={onClose} badge={mission?.streakCount ? `ðŸ”¥${mission.streakCount}` : 'M5'} />
              <NavItem path="/test-review" currentPath={currentPath} icon={ICONS.camera} label="AI ÐŸÑ€ÐµÐ³Ð»ÐµÐ´ÑƒÐ²Ð°Ñ‡" onClick={onClose} badge="NEW" />
              <NavItem path="/live/host" currentPath={currentPath} icon={ICONS.live} label="Ð§Ð°Ñ Ð²Ð¾ Ð¶Ð¸Ð²Ð¾" onClick={onClose} badge="LIVE" />
              <NavItem path="/kahoot/make" currentPath={currentPath} icon={ICONS.live} label="Kahoot Maker" onClick={onClose} badge="NEW" />
              <NavItem path="/exam/build" currentPath={currentPath} icon={ICONS.assessment} label="Ð”Ð¸Ð³Ð¸Ñ‚Ð°Ð»ÐµÐ½ Ð¸ÑÐ¿Ð¸Ñ‚" onClick={onClose} badge="S46" />
              <NavItem path="/data-viz" currentPath={currentPath} icon={ICONS.chart} label="DataViz Studio" onClick={onClose} badge="NEW" />
              <NavItem path="/math-editor" currentPath={currentPath} icon={ICONS.sparkles} label="ÐœÐ°Ñ‚. Ð£Ñ€ÐµÐ´Ð½Ð¸Ðº" onClick={onClose} badge="Î£" />
              <NavItem path="/dugga/build" currentPath={currentPath} icon={ICONS.assessment} label="Ð”Ð¸Ð³Ð° â€” Ð¢ÐµÑÑ‚ Ð“Ñ€Ð°Ð´Ð¸Ñ‚ÐµÐ»" onClick={onClose} badge="ÐÐžÐ’Ðž" />
              <NavItem path="/dugga/play" currentPath={currentPath} icon={ICONS.education} label="Дига — Играј Тест" onClick={onClose} badge="НОВО" />
              <NavItem path="/dugga" currentPath={currentPath} icon={ICONS.analytics} label="Дига — Библиотека" onClick={onClose} />

              {/* Ð Ð°Ð·Ð²Ð¾Ñ˜ Ð½Ð° Ð½Ð°ÑÑ‚Ð°Ð²Ð½Ð¸Ðº */}
              <hr className="my-2 border-gray-100" />
              <p className="px-4 pb-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">{t('sidebar.sec.development')}</p>
              <NavItem path="/academy" currentPath={currentPath} icon={ICONS.education} label={t("nav.academy")} onClick={onClose} badge="NEW" />
              <NavItem path="/my-profile" currentPath={currentPath} icon={ICONS.profile} label="ÐœÐ¾Ñ˜ ÐŸÑ€Ð¾Ñ„Ð¸Ð» (CPD)" onClick={onClose} badge="ÐÐžÐ’Ðž" />
              <NavItem path="/my-progress" currentPath={currentPath} icon={ICONS.analytics} label="ÐœÐ¾Ñ˜ ÐÐ°Ð¿Ñ€ÐµÐ´Ð¾Ðº" onClick={onClose} />
              <NavItem path="/portfolio" currentPath={currentPath} icon={ICONS.star} label="ÐŸÐ¾Ñ€Ñ‚Ñ„Ð¾Ð»Ð¸Ð¾" onClick={onClose} badge="NEW" />

              {/* Ð ÐµÑÑƒÑ€ÑÐ¸ */}
              <hr className="my-2 border-gray-100" />
              <p className="px-4 pb-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">{t('sidebar.sec.resources')}</p>
              <NavItem path="/national-library" currentPath={currentPath} icon={ICONS.bookOpen} label={t("nav.nationalLibrary")} onClick={onClose} />
              <NavItem path="/olympiad" currentPath={currentPath} icon={ICONS.star} label="ÐžÐ»Ð¸Ð¼Ð¿Ð¸ÑÐºÐ° ÐÑ€Ñ…Ð¸Ð²Ð°" onClick={onClose} badge="ðŸ†" />
              <NavItem path="/gallery" currentPath={currentPath} icon={ICONS.gallery} label={t("nav.gallery")} onClick={onClose} />
              <NavItem path="/favorites" currentPath={currentPath} icon={ICONS.star} label={t("nav.favorites")} onClick={onClose} />
              <NavItem path="/reports/coverage" currentPath={currentPath} icon={ICONS.chart} label={t("nav.coverage")} onClick={onClose} />
            </div>
          )}
        </div>
      </nav>
      <div className="p-2 border-t bg-gray-50/50 space-y-2">
        <div className="px-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as import('../i18n').Language)}
              aria-label="Ð˜Ð·Ð±ÐµÑ€Ð¸ Ñ˜Ð°Ð·Ð¸Ðº Ð½Ð° Ð¸Ð½Ñ‚ÐµÑ€Ñ„ÐµÑ˜ÑÐ¾Ñ‚"
              className="w-full text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary py-1.5 px-2"
            >
              <option value="mk">ðŸ‡²ðŸ‡° ÐœÐ°ÐºÐµÐ´Ð¾Ð½ÑÐºÐ¸</option>
              <option value="sq">ðŸ‡¦ðŸ‡± Shqip</option>
              <option value="tr">ðŸ‡¹ðŸ‡· TÃ¼rkÃ§e</option>
            </select>
        </div>
            <InstallPWAButton />

        {/* User Credits / Premium Status Badge */}
        <div className="px-2 pb-1">
          {user?.isPremium || user?.hasUnlimitedCredits || user?.role === 'admin' ? (
            <div className="w-full flex items-center justify-between bg-gradient-to-r from-brand-primary to-purple-800 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm border border-purple-500/30">
              <span className="flex items-center gap-1.5"><ICONS.star className="w-3.5 h-3.5 text-yellow-300" /> Pro ÐÐ°ÑÑ‚Ð°Ð²Ð½Ð¸Ðº</span>
              <span className="opacity-80">âˆž</span >
            </div>
          ) : (
            <div className="w-full flex items-center justify-between bg-white text-gray-700 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:border-brand-primary hover:bg-gray-50 transition-colors"
                 onClick={() => {
                   // This could dispatch an event or use a Context to open the Upgrade Modal globally
                   window.dispatchEvent(new CustomEvent('openUpgradeModal', { detail: { reason: 'ÐžÐ²Ð¾Ñ˜ Ð¿Ñ€ÐµÐ³Ð»ÐµÐ´ Ð²Ð¸ Ð³Ð¸ Ð¿Ñ€Ð¸ÐºÐ°Ð¶ÑƒÐ²Ð° Ñ‚ÐµÐºÐ¾Ð²Ð½Ð¸Ñ‚Ðµ ÐºÑ€ÐµÐ´Ð¸Ñ‚Ð¸. ÐÐ°Ð´Ð³Ñ€Ð°Ð´ÐµÑ‚Ðµ Ð·Ð° Ð½ÐµÐ¾Ð³Ñ€Ð°Ð½Ð¸Ñ‡ÐµÐ½Ð¾!' }}));
                 }}
            >
              <span className="flex items-center gap-1.5"><ICONS.coins className="w-3.5 h-3.5 text-brand-primary" /> ÐšÑ€ÐµÐ´Ð¸Ñ‚Ð¸</span>
              <span className={user?.aiCreditsBalance && user.aiCreditsBalance > 10 ? "text-emerald-600" : "text-red-500"}>
                {user?.aiCreditsBalance || 0}
              </span>
            </div>
          )}
        </div>

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
                    <button type="button" 
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



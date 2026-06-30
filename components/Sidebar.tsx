import { InstallPWAButton } from './common/InstallPWAButton';
import { LANGUAGES } from '../i18n';
import { useLanguage } from '../i18n/LanguageContext';
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Gift } from 'lucide-react';
import { trackEvent } from '../services/telemetryService';
import { APP_NAME, ICONS } from '../constants';
import { LOW_CREDITS_THRESHOLD, CREDITS_WARN_EARLY } from '../hooks/useSubscriptionStatus';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { useForumUnreadCount } from '../hooks/useForumUnreadCount';
import { useMaturaMissions } from '../hooks/useMaturaMissions';
import { getReferralLink } from '../hooks/useReferral';
import { SECONDARY_NAV_GROUPS, isHub } from './navConfig';
import type { BadgeVariant, NavHubConfig } from './navConfig';

// ── Badge colours ────────────────────────────────────────────────────────────
const BADGE_CLASSES: Record<BadgeVariant, string> = {
  ai:   'bg-violet-100 text-violet-800',
  new:  'bg-emerald-100 text-emerald-700',
  live: 'bg-rose-100 text-rose-700 animate-pulse',
  cop:  'bg-amber-100 text-amber-700',
  hub:  'bg-blue-100 text-blue-700',
  ops:  'bg-slate-200 text-slate-600',
};

const BADGE_LABELS: Record<BadgeVariant, string> = {
  ai:   'AI',
  new:  'NEW',
  live: 'LIVE',
  cop:  'CoP',
  hub:  'HUB',
  ops:  'OPS',
};

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
  badge?: BadgeVariant;
  badgeLabel?: string;
  unreadCount?: number;
}> = ({ path, currentPath, icon: Icon, label, onClick, isGenerator = false, badge, badgeLabel, unreadCount }) => {
  const { navigate } = useNavigation();
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
        <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_CLASSES[badge]}`}>
          {badgeLabel ?? BADGE_LABELS[badge]}
        </span>
      )}
    </a>
  );
};

// ── NavHubItem — collapsible sub-group for Matura / Live / Dugga ─────────────
const NavHubItem: React.FC<{
  hub: NavHubConfig;
  currentPath: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  streakCount?: number;
}> = ({ hub, currentPath, isOpen, onToggle, onNavigate, streakCount }) => {
  const { t } = useLanguage();
  const Icon = ICONS[hub.iconKey];
  const isAnyActive = hub.paths.some(p => currentPath === p || currentPath.startsWith(p));

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center px-4 py-2.5 my-0.5 rounded-lg transition-all duration-200 ${
          isAnyActive
            ? 'bg-blue-50 text-brand-primary font-semibold'
            : 'text-gray-600 hover:bg-blue-50 hover:text-brand-primary'
        }`}
      >
        <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
        <span className="font-medium truncate flex-1 text-left">{t(hub.i18nKey)}</span>
        {hub.badge && (
          <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_CLASSES[hub.badge]}`}>
            {BADGE_LABELS[hub.badge]}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 ml-1 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="ml-3 border-l-2 border-gray-100 pl-1 animate-fade-in">
          {hub.items.map((subItem) => {
            const subIcon = ICONS[subItem.iconKey];
            const dynamicBadgeLabel = subItem.dynamicBadge === 'maturaStreak' && streakCount
              ? `🔥${streakCount}`
              : undefined;
            return (
              <NavItem
                key={subItem.path}
                path={subItem.path}
                currentPath={currentPath}
                icon={subIcon}
                label={t(subItem.i18nKey)}
                onClick={onNavigate}
                badge={subItem.badge}
                badgeLabel={dynamicBadgeLabel}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

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
    if (balance > CREDITS_WARN_EARLY || balance < 0) return;
    quotaWarningEmittedRef.current = true;
    trackEvent('quota_warning_seen', { balance, source: 'sidebar_meter', threshold: CREDITS_WARN_EARLY });
  }, [user?.aiCreditsBalance, user?.isPremium, user?.hasUnlimitedCredits, user?.role]);

  // Progressive disclosure — secondary nav collapsed by default, auto-opens when on a secondary path
  const SECONDARY_PATHS = [
    '/explore', '/graph', '/roadmap',
    '/planner', '/annual-planner', '/annual-gallery', '/weekly-plan', '/ai-mindmap',
    '/assistant', '/vision-assessment', '/test-generator', '/grade-book',
    '/matura-portal', '/matura', '/matura-library', '/matura-practice', '/matura-assignments', '/matura-stats', '/test-review', '/live', '/data-viz', '/kahoot',
    '/exam', '/dugga',
    '/academy', '/pro-dev', '/my-profile', '/my-progress', '/portfolio', '/student',
    '/national-library', '/olympiad', '/gallery', '/favorites', '/reports/coverage',
    // Note: /scenario-bank is PRIMARY nav — intentionally excluded here so secondary doesn't auto-expand
  ];
  const isSecondaryPath = (p: string) => SECONDARY_PATHS.some(sp => p === sp || p.startsWith(sp));

  const [showMore, setShowMore] = useState(() => isSecondaryPath(currentPath));

  // Auto-expand when navigating to any secondary path (handles post-mount navigation)
  useEffect(() => {
    if (isSecondaryPath(currentPath)) setShowMore(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // Hub open/close state — auto-opens hub when current path is within it
  const [openHubs, setOpenHubs] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const group of SECONDARY_NAV_GROUPS) {
      for (const item of group.items) {
        if (isHub(item) && item.paths.some(p => currentPath === p || currentPath.startsWith(p))) {
          initial.add(item.hubId);
        }
      }
    }
    return initial;
  });

  useEffect(() => {
    for (const group of SECONDARY_NAV_GROUPS) {
      for (const item of group.items) {
        if (isHub(item) && item.paths.some(p => currentPath === p || currentPath.startsWith(p))) {
          setOpenHubs(prev => prev.has(item.hubId) ? prev : new Set([...prev, item.hubId]));
        }
      }
    }
  }, [currentPath]);

  const toggleHub = (hubId: string) =>
    setOpenHubs(prev => { const n = new Set(prev); n.has(hubId) ? n.delete(hubId) : n.add(hubId); return n; });

  return (
    <aside className={`w-64 bg-white text-gray-800 flex flex-col h-screen fixed shadow-2xl z-30 no-print transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 border-r border-gray-100`}>
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h1 className="text-xl font-bold text-brand-primary truncate" title={APP_NAME}>{APP_NAME}</h1>
        <button type="button"
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
          <NavItem path="/" currentPath={currentPath} icon={ICONS.home} label={t('nav.home')} onClick={onClose} />
          <NavItem path="/generator" currentPath={currentPath} icon={ICONS.generator} label={t('nav.generator')} onClick={onClose} isGenerator={true} badge="ai" />
          <NavItem path="/matura-assignments" currentPath={currentPath} icon={ICONS.education} label={t('nav.maturaAssignments')} onClick={onClose} badge="new" />
          <NavItem path="/my-lessons" currentPath={currentPath} icon={ICONS.myLessons} label={t('nav.mylessons')} onClick={onClose} />
          <NavItem path="/analytics" currentPath={currentPath} icon={ICONS.analytics} label={t('nav.analytics')} onClick={onClose} />
          <NavItem path="/scenario-bank" currentPath={currentPath} icon={ICONS.bookOpen} label={t('nav.scenarioBank')} onClick={onClose} badge="hub" />
          <NavItem path="/forum" currentPath={currentPath} icon={ICONS.chatBubble} label={t('nav.forum')} onClick={onClose} badge="cop" unreadCount={forumUnread} />
          {(user?.role === 'school_admin' || user?.role === 'admin') && (
            <>
              <NavItem path="/school-admin" currentPath={currentPath} icon={ICONS.school} label={t('nav.schooladmin')} onClick={onClose} />
              <NavItem path="/school-admin/curriculum" currentPath={currentPath} icon={ICONS.bookOpen} label={t('nav.editCurriculum')} onClick={onClose} badge="new" />
              <NavItem path="/reviews" currentPath={currentPath} icon={ICONS.shieldCheck} label={t('nav.reviews')} onClick={onClose} />
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <NavItem path="/system-admin" currentPath={currentPath} icon={ICONS.shieldAlert} label={t('nav.schools')} onClick={onClose} />
              <NavItem path="/slo" currentPath={currentPath} icon={ICONS.activity} label={t('nav.sloDashboard')} onClick={onClose} badge="ops" />
            </>
          )}
          <NavItem path="/settings" currentPath={currentPath} icon={ICONS.settings} label={t('nav.settings')} onClick={onClose} />
        </div>

        {/* ── SECONDARY NAV (collapsible, data-driven) ── */}
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
              {SECONDARY_NAV_GROUPS.map((group) => (
                <div key={group.sectionI18nKey}>
                  <hr className="my-2 border-gray-100" />
                  <p className="px-4 pb-1 text-[11px] font-bold text-gray-400 tracking-wide">
                    {t(group.sectionI18nKey)}
                  </p>
                  {group.items.map((item) => {
                    if (isHub(item)) {
                      return (
                        <NavHubItem
                          key={item.hubId}
                          hub={item}
                          currentPath={currentPath}
                          isOpen={openHubs.has(item.hubId)}
                          onToggle={() => toggleHub(item.hubId)}
                          onNavigate={onClose}
                          streakCount={mission?.streakCount}
                        />
                      );
                    }
                    const icon = ICONS[item.iconKey];
                    const dynamicBadgeLabel = item.dynamicBadge === 'maturaStreak' && mission?.streakCount
                      ? `🔥${mission.streakCount}`
                      : undefined;
                    return (
                      <NavItem
                        key={item.path}
                        path={item.path}
                        currentPath={currentPath}
                        icon={icon}
                        label={t(item.i18nKey)}
                        onClick={onClose}
                        badge={item.badge}
                        badgeLabel={dynamicBadgeLabel}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="p-2 border-t bg-gray-50/50 space-y-2">
        {/* Referral CTA — shown only to authenticated teachers/admins */}
        {firebaseUser?.uid && (
          <button
            type="button"
            onClick={async () => {
              const link = getReferralLink(firebaseUser.uid);
              try {
                await navigator.clipboard.writeText(link);
                trackEvent('feature_open_referral', { source: 'sidebar' });
              } catch { /* blocked */ }
              navigate('/settings');
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors text-left"
          >
            <Gift className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-800 truncate">Покани колега — +10 кредити</p>
              <p className="text-[10px] text-amber-600 truncate">Сподели го твојот линк</p>
            </div>
          </button>
        )}
        <div className="px-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as import('../i18n').Language)}
            aria-label="Избери јазик на интерфејсот"
            className="w-full text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary py-1.5 px-2"
          >
            <option value="mk">🇲🇰 Македонски</option>
            <option value="sq">🇦🇱 Shqip</option>
            <option value="tr">🇹🇷 Türkçe</option>
          </select>
        </div>
        <InstallPWAButton />

        {/* User Credits / Premium Status Badge */}
        <div className="px-2 pb-1">
          {user?.isPremium || user?.hasUnlimitedCredits || user?.role === 'admin' ? (
            <div className="w-full flex items-center justify-between bg-gradient-to-r from-brand-primary to-purple-800 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm border border-purple-500/30">
              <span className="flex items-center gap-1.5"><ICONS.star className="w-3.5 h-3.5 text-yellow-300" /> Pro Наставник</span>
              <span className="opacity-80">∞</span>
            </div>
          ) : (
            <div
              className={`w-full flex items-center justify-between bg-white text-gray-700 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm border transition-colors cursor-pointer ${
                (user?.aiCreditsBalance ?? 0) <= LOW_CREDITS_THRESHOLD
                  ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
                  : 'border-gray-200 hover:border-brand-primary hover:bg-gray-50'
              }`}
              onClick={() => { navigate((user?.aiCreditsBalance ?? 0) <= LOW_CREDITS_THRESHOLD ? '/pricing' : '/usage'); onClose(); }}
            >
              <span className="flex items-center gap-1.5">
                <ICONS.coins className="w-3.5 h-3.5 text-brand-primary" /> Кредити
              </span>
              <span className={`flex items-center gap-1 ${(user?.aiCreditsBalance ?? 0) > CREDITS_WARN_EARLY ? 'text-emerald-600' : 'text-red-500'}`}>
                {user?.aiCreditsBalance || 0}
                {(user?.aiCreditsBalance ?? 0) <= LOW_CREDITS_THRESHOLD && <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1 rounded">→ Pro</span>}
              </span>
            </div>
          )}
        </div>

        <div
          onClick={() => { navigate('/settings'); onClose(); }}
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
                onClick={(e) => { e.stopPropagation(); logout(); }}
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

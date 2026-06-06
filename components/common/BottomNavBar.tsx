/**
 * BottomNavBar — Mobile bottom navigation (< 768px only).
 * Shows 5 primary actions as icon+label tabs fixed at the bottom of the screen.
 * On desktop (md+) this component renders nothing — the Sidebar takes over.
 */
import React from 'react';
import { ICONS } from '../../constants';
import { useNavigation } from '../../contexts/NavigationContext';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';
import { useForumUnreadCount } from '../../hooks/useForumUnreadCount';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';

interface BottomNavBarProps {
    currentPath: string;
}

interface NavTabProps {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    isActive: boolean;
    onClick: () => void;
    badge?: number;
}

const NavTab: React.FC<NavTabProps> = ({ label, icon: Icon, isActive, onClick, badge }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative transition-colors ${
            isActive
                ? 'text-brand-primary'
                : 'text-gray-500 active:text-brand-primary'
        }`}
        aria-current={isActive ? 'page' : undefined}
    >
        <span className="relative">
            <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110' : ''}`} />
            {badge != null && badge > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-black bg-rose-500 text-white px-1 rounded-full">
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
        </span>
        <span className={`text-[10px] font-semibold leading-none ${isActive ? 'text-brand-primary' : 'text-gray-500'}`}>
            {label}
        </span>
        {isActive && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-brand-primary" />
        )}
    </button>
);

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentPath }) => {
    const { navigate } = useNavigation();
    const { openGeneratorPanel } = useGeneratorPanel();
    const { firebaseUser } = useAuth();
    const { t } = useLanguage();
    const forumUnread = useForumUnreadCount(firebaseUser?.uid ?? null);

    const isActive = (path: string) => {
        if (path === '/') return currentPath === '/';
        return currentPath.startsWith(path);
    };

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex items-stretch z-30 no-print shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"
            aria-label={t('nav.tab.home')}
        >
            <NavTab
                label={t('nav.tab.home')}
                icon={ICONS.home}
                isActive={isActive('/')}
                onClick={() => navigate('/')}
            />
            <NavTab
                label={t('nav.tab.ai')}
                icon={ICONS.generator}
                isActive={false}
                onClick={() => openGeneratorPanel({})}
            />
            <NavTab
                label={t('nav.tab.lessons')}
                icon={ICONS.myLessons}
                isActive={isActive('/my-lessons')}
                onClick={() => navigate('/my-lessons')}
            />
            <NavTab
                label={t('nav.tab.analytics')}
                icon={ICONS.analytics}
                isActive={isActive('/analytics')}
                onClick={() => navigate('/analytics')}
            />
            <NavTab
                label={t('nav.tab.forum')}
                icon={ICONS.chatBubble}
                isActive={isActive('/forum')}
                onClick={() => navigate('/forum')}
                badge={forumUnread}
            />
        </nav>
    );
};

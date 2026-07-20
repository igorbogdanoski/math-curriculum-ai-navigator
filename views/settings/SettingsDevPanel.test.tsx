import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsDevPanel } from './SettingsDevPanel';
import { LanguageProvider } from '../../i18n/LanguageContext';

let mockUser: { role: string; isMentor?: boolean } = { role: 'teacher' };

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, firebaseUser: { uid: 'u1' } }),
}));

vi.mock('../../contexts/NotificationContext', () => ({
  useNotification: () => ({ addNotification: vi.fn() }),
}));

vi.mock('../../components/common/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/common/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('../../services/firestoreService', () => ({
  firestoreService: {
    toggleMentorStatus: vi.fn(),
    saveFullCurriculum: vi.fn(),
  },
}));

vi.mock('../../services/pushService', () => ({
  requestNotificationPermission: vi.fn(),
}));

vi.mock('../../services/feedbackTaxonomyRollout', () => ({
  isFeedbackTaxonomyRolloutEnabled: () => false,
  setFeedbackTaxonomyRolloutEnabled: vi.fn(),
}));

vi.mock('../../services/featureFlags/globalConfig', () => ({
  getGlobalDefault: () => undefined,
  setGlobalDefault: vi.fn(),
}));

vi.mock('../../services/geminiService', () => ({
  isDailyQuotaKnownExhausted: () => false,
  clearDailyQuotaFlag: vi.fn(),
  scheduleQuotaNotification: vi.fn(),
  getQuotaDiagnostics: () => ({ isCurrentlyExhausted: false, source: 'none' }),
  isMacedonianContextEnabled: () => true,
  setMacedonianContextEnabled: vi.fn(),
  isRecoveryWorksheetEnabled: () => false,
  setRecoveryWorksheetEnabled: vi.fn(),
  isIntentRouterEnabled: () => true,
  setIntentRouterEnabled: vi.fn(),
  isVertexShadowEnabled: () => false,
  setVertexShadowEnabled: vi.fn(),
  getShadowCompareReport: vi.fn(),
  clearShadowLog: vi.fn(),
}));

vi.mock('../../services/gemini/core', () => ({ DEFAULT_MODEL: 'gemini-2.5-flash' }));

describe('SettingsDevPanel — global admin card visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('preferred_language', 'mk');
  });

  it('hides the global (admin-only) settings card for a regular teacher', () => {
    mockUser = { role: 'teacher' };
    render(<LanguageProvider><SettingsDevPanel /></LanguageProvider>);
    expect(screen.queryByText(/Глобални поставки \(само админ\)/)).toBeNull();
  });

  it('shows the global settings card for an admin', () => {
    mockUser = { role: 'admin' };
    render(<LanguageProvider><SettingsDevPanel /></LanguageProvider>);
    expect(screen.getByText(/Глобални поставки \(само админ\)/)).toBeTruthy();
  });
});

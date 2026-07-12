/**
 * P3 — the streak-reminder opt-in button only makes sense for a Google-linked
 * student (the daily push needs a stable uid to send to — see
 * functions/src/index.ts's sendDailyStreakReminders), and only when the
 * browser hasn't already been asked for notification permission.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GamificationPanel } from './GamificationPanel';

let mockFirebaseUser: { uid: string; isAnonymous: boolean } | null = null;
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: mockFirebaseUser }),
}));

vi.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const requestNotificationPermission = vi.fn();
vi.mock('../../services/pushService', () => ({
  requestNotificationPermission: (uid: string) => requestNotificationPermission(uid),
}));

const gamification = {
  studentName: 'Марко',
  totalXP: 100,
  currentStreak: 3,
  longestStreak: 5,
  totalQuizzes: 10,
  achievements: [],
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockFirebaseUser = null;
  // @ts-expect-error — test-only global stub
  delete global.Notification;
});

describe('GamificationPanel — streak-reminder opt-in', () => {
  it('shows the reminder button for a Google-linked student with default (unasked) permission', () => {
    mockFirebaseUser = { uid: 'uid-1', isAnonymous: false };
    // @ts-expect-error — test-only global stub
    global.Notification = { permission: 'default' };

    render(<GamificationPanel gamification={gamification} classRank={null} />);
    expect(screen.getByTitle(/потсетник пред да ја изгубам серијата/i)).toBeTruthy();
  });

  it('requests notification permission with the student uid on click', () => {
    mockFirebaseUser = { uid: 'uid-1', isAnonymous: false };
    // @ts-expect-error — test-only global stub
    global.Notification = { permission: 'default' };

    render(<GamificationPanel gamification={gamification} classRank={null} />);
    fireEvent.click(screen.getByTitle(/потсетник пред да ја изгубам серијата/i));
    expect(requestNotificationPermission).toHaveBeenCalledWith('uid-1');
  });

  it('hides the button for an anonymous (device-only) student — no stable channel to notify', () => {
    mockFirebaseUser = { uid: 'anon-1', isAnonymous: true };
    // @ts-expect-error — test-only global stub
    global.Notification = { permission: 'default' };

    render(<GamificationPanel gamification={gamification} classRank={null} />);
    expect(screen.queryByTitle(/потсетник пред да ја изгубам серијата/i)).toBeNull();
  });

  it('hides the button once permission has already been granted', () => {
    mockFirebaseUser = { uid: 'uid-1', isAnonymous: false };
    // @ts-expect-error — test-only global stub
    global.Notification = { permission: 'granted' };

    render(<GamificationPanel gamification={gamification} classRank={null} />);
    expect(screen.queryByTitle(/потсетник пред да ја изгубам серијата/i)).toBeNull();
  });

  it('hides the button when there is no authenticated user at all', () => {
    mockFirebaseUser = null;
    // @ts-expect-error — test-only global stub
    global.Notification = { permission: 'default' };

    render(<GamificationPanel gamification={gamification} classRank={null} />);
    expect(screen.queryByTitle(/потсетник пред да ја изгубам серијата/i)).toBeNull();
  });
});

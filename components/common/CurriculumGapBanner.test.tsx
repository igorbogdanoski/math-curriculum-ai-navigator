import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CurriculumGapBanner } from './CurriculumGapBanner';
import { useAuth } from '../../contexts/AuthContext';
import { getDocs } from 'firebase/firestore';
import { isDailyQuotaKnownExhausted } from '../../services/geminiService';

vi.mock('../../firebaseConfig', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col-ref'),
  query: vi.fn((...args) => ['query-ref', ...args]),
  where: vi.fn((...args) => ['where', ...args]),
  orderBy: vi.fn((...args) => ['orderBy', ...args]),
  limit: vi.fn((...args) => ['limit', ...args]),
  getDocs: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../services/geminiService', () => ({ isDailyQuotaKnownExhausted: vi.fn(() => false) }));

const planSnap = (topics: { title: string }[], grade = '8') => ({
  empty: false,
  docs: [{ data: () => ({ grade, planData: { topics } }) }],
});

describe('CurriculumGapBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: { uid: 'teacher-1' } } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(isDailyQuotaKnownExhausted).mockReturnValue(false);
    try { localStorage.clear(); } catch { /* noop */ }
  });

  it('renders nothing for a teacher with no annual plan', async () => {
    vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as any);
    render(<CurriculumGapBanner />);
    await waitFor(() => expect(getDocs).toHaveBeenCalled());
    expect(screen.queryByText(/стандарди/)).toBeNull();
  });

  it('renders nothing for a student session (no firebaseUser)', () => {
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: null } as unknown as ReturnType<typeof useAuth>);
    render(<CurriculumGapBanner />);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('shows a nudge when the plan leaves most БРО standards uncovered', async () => {
    // Topics that don't match any real standard's mathBridge/description keywords —
    // coverage should land well under the threshold.
    vi.mocked(getDocs).mockResolvedValue(planSnap([{ title: 'Случајна нематематичка тема XyZ' }]) as any);
    render(<CurriculumGapBanner />);
    await waitFor(() => {
      expect(screen.getByText(/стандарди/)).toBeTruthy();
    });
  });

  it('defers to an exhausted-quota state instead of overlapping banners', async () => {
    vi.mocked(isDailyQuotaKnownExhausted).mockReturnValue(true);
    vi.mocked(getDocs).mockResolvedValue(planSnap([{ title: 'Случајна нематематичка тема' }]) as any);
    render(<CurriculumGapBanner />);
    await waitFor(() => expect(getDocs).toHaveBeenCalled());
    expect(screen.queryByText(/стандарди/)).toBeNull();
  });

  it('does not re-fetch when previously dismissed within the cooldown window', () => {
    try { localStorage.setItem('curriculum_gap_banner_dismissed_until', String(Date.now() + 86400_000)); } catch { /* noop */ }
    render(<CurriculumGapBanner />);
    expect(getDocs).not.toHaveBeenCalled();
  });
});

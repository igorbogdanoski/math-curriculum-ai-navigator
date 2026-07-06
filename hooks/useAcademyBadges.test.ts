import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAcademyBadges } from './useAcademyBadges';
import { academyBadgesService } from '../services/firestoreService.academyBadges';

vi.mock('../services/firestoreService.academyBadges', () => ({
  academyBadgesService: { getBadges: vi.fn() },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useAcademyBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not query and returns no badges when uid is undefined', () => {
    const { result } = renderHook(() => useAcademyBadges(undefined), { wrapper });
    expect(academyBadgesService.getBadges).not.toHaveBeenCalled();
    expect(result.current.badges).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('joins returned ids against SPECIALIZATIONS', async () => {
    vi.mocked(academyBadgesService.getBadges).mockResolvedValue(['inclusive-teacher', 'assessment-master']);
    const { result } = renderHook(() => useAcademyBadges('u1'), { wrapper });

    await waitFor(() => expect(result.current.badges.length).toBe(2));
    expect(result.current.badges.map(b => b.id).sort()).toEqual(['assessment-master', 'inclusive-teacher']);
  });

  it('returns an empty badge list for an unknown id (e.g. ai-expert)', async () => {
    vi.mocked(academyBadgesService.getBadges).mockResolvedValue([]);
    const { result } = renderHook(() => useAcademyBadges('ai-expert'), { wrapper });

    await waitFor(() => expect(academyBadgesService.getBadges).toHaveBeenCalledWith('ai-expert'));
    expect(result.current.badges).toEqual([]);
  });
});

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AcademyBadgeChip, AcademyBadgeRow } from './AcademyBadgeChip';
import { useAcademyBadges } from '../../hooks/useAcademyBadges';
import { SPECIALIZATIONS } from '../../data/academy/specializations';

vi.mock('../../hooks/useAcademyBadges', () => ({ useAcademyBadges: vi.fn() }));

describe('AcademyBadgeChip', () => {
  it('renders the specialization emoji with a title tooltip', () => {
    const spec = SPECIALIZATIONS[0];
    render(<AcademyBadgeChip specialization={spec} />);
    expect(screen.getByTitle(spec.title)).toBeTruthy();
  });
});

describe('AcademyBadgeRow', () => {
  it('renders nothing when the teacher has no badges', () => {
    vi.mocked(useAcademyBadges).mockReturnValue({ badges: [], isLoading: false });
    const { container } = render(<AcademyBadgeRow uid="u1" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders up to max badges plus a +N overflow chip', () => {
    vi.mocked(useAcademyBadges).mockReturnValue({ badges: SPECIALIZATIONS, isLoading: false });
    render(<AcademyBadgeRow uid="u1" max={2} />);

    expect(screen.getByTitle(SPECIALIZATIONS[0].title)).toBeTruthy();
    expect(screen.getByTitle(SPECIALIZATIONS[1].title)).toBeTruthy();
    expect(screen.queryByTitle(SPECIALIZATIONS[2].title)).toBeNull();
    expect(screen.getByText(`+${SPECIALIZATIONS.length - 2}`)).toBeTruthy();
  });

  it('renders all badges with no overflow chip when count is within max', () => {
    vi.mocked(useAcademyBadges).mockReturnValue({ badges: [SPECIALIZATIONS[0]], isLoading: false });
    render(<AcademyBadgeRow uid="u1" />);
    expect(screen.getByTitle(SPECIALIZATIONS[0].title)).toBeTruthy();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });
});

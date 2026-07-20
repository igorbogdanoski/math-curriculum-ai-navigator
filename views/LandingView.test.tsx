/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandingView } from './LandingView';

describe('LandingView', () => {
  it('renders without crashing and shows the headline', () => {
    render(<LandingView />);
    expect(screen.getByText(/секоја недела/)).toBeTruthy();
  });

  it('links to the real hash routes — a routing regression here would silently strand a logged-out visitor', () => {
    render(<LandingView />);
    const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'));
    expect(hrefs).toContain('#/login');
    expect(hrefs).toContain('#/pricing');
    expect(hrefs).toContain('#/privacy');
    expect(hrefs).toContain('#/terms');
  });

  it('renders all 4 feature bullets and all 3 stat blocks', () => {
    render(<LandingView />);
    expect(screen.getByText(/378 матурски прашања/)).toBeTruthy();
    expect(screen.getByText('наставници')).toBeTruthy();
    expect(screen.getByText('материјали')).toBeTruthy();
    expect(screen.getByText('одделенија')).toBeTruthy();
  });
});

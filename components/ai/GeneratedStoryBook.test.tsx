import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GeneratedStoryBook } from './GeneratedStoryBook';
import type { AIGeneratedStoryBook } from '../../types';

const material: AIGeneratedStoryBook = {
  title: { en: 'The Number Garden', mk: 'Градината на броевите', sq: 'Kopshti i Numrave', tr: 'Sayı Bahçesi' },
  ageRange: '7-9',
  pages: [
    {
      imageUrl: 'https://storage.example/page1.png',
      caption: { en: 'Page one EN', mk: 'Страница еден МК', sq: 'Faqja një SQ', tr: 'Sayfa bir TR' },
    },
    {
      imageUrl: 'https://storage.example/page2.png',
      caption: { en: 'Page two EN', mk: 'Страница два МК', sq: 'Faqja dy SQ', tr: 'Sayfa iki TR' },
    },
  ],
};

describe('GeneratedStoryBook', () => {
  it('renders the title and first page caption in Macedonian by default', () => {
    render(<GeneratedStoryBook material={material} />);
    expect(screen.getByText('Градината на броевите')).toBeTruthy();
    expect(screen.getByText('Страница еден МК')).toBeTruthy();
  });

  it('switches the displayed caption when the language selector changes — no image change', () => {
    render(<GeneratedStoryBook material={material} />);
    // The hidden print-only view also renders page 2's image, so there are 2 <img>s
    // in the DOM even though only page 1 is visible — the current page's image is
    // always the first one rendered.
    const firstImage = screen.getAllByRole('img')[0] as HTMLImageElement;
    const originalSrc = firstImage.src;

    fireEvent.change(screen.getByLabelText(/избери јазик/i), { target: { value: 'en' } });

    expect(screen.getByText('Page one EN')).toBeTruthy();
    expect(screen.queryByText('Страница еден МК')).toBeNull();
    expect((screen.getAllByRole('img')[0] as HTMLImageElement).src).toBe(originalSrc);
  });

  it('navigates to the next page without regenerating anything, showing that page\'s own image and caption', () => {
    render(<GeneratedStoryBook material={material} />);
    fireEvent.click(screen.getByText(/следна/i));
    // Page 2 also appears a second time in the print-only stacked view (hidden via
    // CSS, not removed from the DOM), so there are 2 matches — assert on the first.
    expect(screen.getAllByText('Страница два МК').length).toBeGreaterThan(0);
    expect((screen.getAllByRole('img')[0] as HTMLImageElement).src).toBe('https://storage.example/page2.png');
  });

  it('renders an error message instead of pages when material.error is set', () => {
    render(<GeneratedStoryBook material={{ ...material, error: 'Генерирањето не успеа.' }} />);
    expect(screen.getByText('Генерирањето не успеа.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { GeneratedTechnicalInfographic } from './GeneratedTechnicalInfographic';
import type { AIGeneratedTechnicalInfographic } from '../../types';

const material: AIGeneratedTechnicalInfographic = {
  title: { en: 'Square Pyramid', mk: 'Четиристрана пирамида', sq: 'Piramida Katërkëndëshe', tr: 'Kare Piramit' },
  imageUrl: 'https://storage.example/pyramid.png',
  sections: [
    {
      key: 'overview',
      heading: { en: 'Overview', mk: 'Преглед', sq: 'Përmbledhje', tr: 'Genel Bakış' },
      body: { en: 'Overview body EN', mk: 'Текст МК', sq: 'Teksti SQ', tr: 'Metin TR' },
    },
  ],
};

describe('GeneratedTechnicalInfographic', () => {
  it('renders the title and section text in Macedonian by default', () => {
    render(<GeneratedTechnicalInfographic material={material} />);
    expect(screen.getByText('Четиристрана пирамида')).toBeTruthy();
    expect(screen.getByText('Преглед')).toBeTruthy();
    expect(screen.getByText('Текст МК')).toBeTruthy();
  });

  it('switches all displayed text when the language selector changes — the image never changes', () => {
    render(<GeneratedTechnicalInfographic material={material} />);
    const image = screen.getByRole('img') as HTMLImageElement;
    const originalSrc = image.src;

    fireEvent.change(screen.getByLabelText(/избери јазик/i), { target: { value: 'tr' } });

    expect(screen.getByText('Kare Piramit')).toBeTruthy();
    expect(screen.getByText('Genel Bakış')).toBeTruthy();
    expect(screen.queryByText('Четиристрана пирамида')).toBeNull();
    expect((screen.getByRole('img') as HTMLImageElement).src).toBe(originalSrc);
  });

  it('renders an error message instead of the infographic when material.error is set', () => {
    render(<GeneratedTechnicalInfographic material={{ ...material, error: 'Генерирањето не успеа.' }} />);
    expect(screen.getByText('Генерирањето не успеа.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

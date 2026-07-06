import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AcademyReflectionPrompt } from './AcademyReflectionPrompt';

describe('AcademyReflectionPrompt', () => {
  it('pre-fills the textarea from an existing note', () => {
    render(<AcademyReflectionPrompt existingNote="Претходна белешка" onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByDisplayValue('Претходна белешка')).toBeTruthy();
  });

  it('starts empty when there is no existing note', () => {
    render(<AcademyReflectionPrompt existingNote={undefined} onSave={vi.fn()} onClose={vi.fn()} />);
    const textarea = screen.getByPlaceholderText(/Дали методот функционираше/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('"Зачувај" saves the typed note and closes', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<AcademyReflectionPrompt existingNote={undefined} onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText(/Дали методот функционираше/), { target: { value: 'Функционираше одлично.' } });
    fireEvent.click(screen.getByText('Зачувај'));

    expect(onSave).toHaveBeenCalledWith('Функционираше одлично.');
    expect(onClose).toHaveBeenCalled();
  });

  it('"Зачувај" with an empty note closes without saving', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<AcademyReflectionPrompt existingNote={undefined} onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByText('Зачувај'));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('"Прескокни" closes without saving, even with typed text', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<AcademyReflectionPrompt existingNote={undefined} onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText(/Дали методот функционираше/), { target: { value: 'Некоја белешка' } });
    fireEvent.click(screen.getByText('Прескокни'));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

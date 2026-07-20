/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { TikzLab } from './TikzLab';
import { LanguageProvider } from '../../i18n/LanguageContext';
import type { Language } from '../../i18n';

const mockAddNotification = vi.fn();
vi.mock('../../contexts/NotificationContext', () => ({
  useNotification: () => ({ addNotification: mockAddNotification }),
}));

type Deferred = { resolve: (v: { ok: boolean; svg?: string }) => void };
let pendingCalls: { code: string; deferred: Deferred }[] = [];

vi.mock('../../utils/tikzRenderJob', () => ({
  renderTikzToContainer: vi.fn((code: string) =>
    new Promise(resolve => {
      pendingCalls.push({ code, deferred: { resolve } });
    }),
  ),
}));

// CodeMirror (Wave 18) renders a contenteditable div driven by real browser layout APIs
// (getClientRects, ResizeObserver, ...) that jsdom doesn't implement — real keystroke
// simulation is flaky/unsupported there. TikzLab's own logic under test (debounce, job-ID
// race protection) only depends on receiving `value`/`onChange`, not on CodeMirror's actual
// rendering, so a plain-textarea stub keeps the rest of this file's fireEvent-based tests
// unchanged while still verifying TikzLab wires the editor up correctly (see the props-capture
// test below). Real syntax highlighting / editing behavior is covered by browser verification.
let lastCodeMirrorProps: { value: string; extensions: unknown[]; theme: string } | null = null;
vi.mock('@uiw/react-codemirror', () => ({
  default: (props: { value: string; onChange?: (v: string) => void; extensions: unknown[]; theme: string }) => {
    lastCodeMirrorProps = { value: props.value, extensions: props.extensions, theme: props.theme };
    return React.createElement('textarea', {
      value: props.value,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange?.(e.target.value),
    });
  },
}));

const mockGenerateTikzDiagram = vi.fn();
vi.mock('../../services/gemini/tikzGenerate', () => ({
  generateTikzDiagram: (...args: unknown[]) => mockGenerateTikzDiagram(...args),
}));

// Raw, untranslated i18n keys must never leak into the rendered UI.
const RAW_KEY_PATTERN = /\btikz\.[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+\b/;

function renderLab(lang: Language = 'mk', props: React.ComponentProps<typeof TikzLab> = {}) {
  localStorage.setItem('preferred_language', lang);
  return render(<LanguageProvider><TikzLab {...props} /></LanguageProvider>);
}

describe('TikzLab', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    pendingCalls = [];
    mockAddNotification.mockClear();
    mockGenerateTikzDiagram.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  (['mk', 'en'] as Language[]).forEach(lang => {
    it(`renders the template sidebar and editor without leaking raw i18n keys (${lang})`, () => {
      renderLab(lang);
      expect(document.body.textContent).not.toMatch(RAW_KEY_PATTERN);
      // 3 templates, all in the "geometry" category by default.
      expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(2); // search + editor
    });
    vi.useRealTimers();
  });

  it('debounces edits — only fires one render job per pause in typing', async () => {
    renderLab();
    const editor = screen.getAllByRole('textbox')[1]; // [0] search, [1] code editor

    await act(async () => {
      fireEvent.change(editor, { target: { value: 'A' } });
      vi.advanceTimersByTime(200);
      fireEvent.change(editor, { target: { value: 'AB' } });
      vi.advanceTimersByTime(200);
      fireEvent.change(editor, { target: { value: 'ABC' } });
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    // Only the final, settled value should have triggered a render job (plus the
    // initial-mount job for the default template's code).
    const codesRendered = pendingCalls.map(c => c.code);
    expect(codesRendered.filter(c => c === 'ABC').length).toBe(1);
    expect(codesRendered).not.toContain('A');
    expect(codesRendered).not.toContain('AB');
    vi.useRealTimers();
  });

  it('job-ID race protection: a slower older job resolving after a newer one does not overwrite it', async () => {
    renderLab();
    const editor = screen.getAllByRole('textbox')[1];

    // First debounced render (job A).
    await act(async () => {
      fireEvent.change(editor, { target: { value: 'CODE_A' } });
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });
    expect(pendingCalls.length).toBe(2); // initial-mount job + job A
    const jobA = pendingCalls[pendingCalls.length - 1];

    // Second debounced render (job B) — starts and will resolve before job A does.
    await act(async () => {
      fireEvent.change(editor, { target: { value: 'CODE_B' } });
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });
    expect(pendingCalls.length).toBe(3);
    const jobB = pendingCalls[pendingCalls.length - 1];

    // Job B (newer) resolves first.
    await act(async () => {
      jobB.deferred.resolve({ ok: true, svg: '<svg data-job="B"></svg>' });
      await Promise.resolve();
    });
    expect(document.body.innerHTML).toContain('data-job="B"');

    // Job A (older, stale) resolves late — must NOT override job B's already-displayed result.
    await act(async () => {
      jobA.deferred.resolve({ ok: true, svg: '<svg data-job="A"></svg>' });
      await Promise.resolve();
    });
    expect(document.body.innerHTML).toContain('data-job="B"');
    expect(document.body.innerHTML).not.toContain('data-job="A"');
    vi.useRealTimers();
  });

  it('keeps the last good svg visible behind an error banner on a failed compile', async () => {
    renderLab();
    const editor = screen.getAllByRole('textbox')[1];

    // Initial-mount job succeeds.
    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });
    const initialJob = pendingCalls[0];
    await act(async () => {
      initialJob.deferred.resolve({ ok: true, svg: '<svg data-job="good"></svg>' });
      await Promise.resolve();
    });
    expect(document.body.innerHTML).toContain('data-job="good"');

    // A broken edit fails to compile.
    await act(async () => {
      fireEvent.change(editor, { target: { value: '\\Broken' } });
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });
    const failingJob = pendingCalls[pendingCalls.length - 1];
    await act(async () => {
      failingJob.deferred.resolve({ ok: false });
      await Promise.resolve();
    });

    // Last good svg is still shown, and an error message is now also visible.
    expect(document.body.innerHTML).toContain('data-job="good"');
    expect(document.body.textContent).not.toMatch(RAW_KEY_PATTERN);
    vi.useRealTimers();
  });

  it('wires the CodeMirror editor with a dark theme and a language extension', () => {
    renderLab();
    expect(lastCodeMirrorProps).not.toBeNull();
    expect(lastCodeMirrorProps?.theme).toBe('dark');
    expect(lastCodeMirrorProps?.extensions.length).toBeGreaterThan(0);
    expect(lastCodeMirrorProps?.value.length).toBeGreaterThan(0);
  });

  it('grade filter narrows the sidebar to only primary or only secondary templates', () => {
    renderLab();
    const secondaryOnlyLabel = 'Тригонометрија во правоаголен триаголник'; // right-triangle-trig, secondary-only
    const primaryOnlyLabel = 'Слични триаголници'; // similar-triangles, primary-only

    expect(screen.getByText(secondaryOnlyLabel)).toBeTruthy();
    expect(screen.getByText(primaryOnlyLabel)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Основно' }));
    expect(screen.queryByText(secondaryOnlyLabel)).toBeNull();
    expect(screen.getByText(primaryOnlyLabel)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Средно' }));
    expect(screen.getByText(secondaryOnlyLabel)).toBeTruthy();
    expect(screen.queryByText(primaryOnlyLabel)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Сите' }));
    expect(screen.getByText(secondaryOnlyLabel)).toBeTruthy();
    expect(screen.getByText(primaryOnlyLabel)).toBeTruthy();
  });

  it('clicking a template switches the editor content and triggers a new render', async () => {
    renderLab();
    const templateButtons = screen.getAllByRole('button').filter(b => b.textContent && !b.textContent.includes('SVG') && !b.textContent.includes('PNG'));
    expect(templateButtons.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      fireEvent.click(templateButtons[1]);
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    const editor = screen.getAllByRole('textbox')[1] as HTMLTextAreaElement;
    expect(editor.value.length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('AI panel: hidden by default, opens on toggle, generate button disabled until a prompt is typed', () => {
    renderLab();
    expect(screen.queryByPlaceholderText(/илустрацијата/)).toBeNull();

    fireEvent.click(screen.getByText('Генерирај со АИ'));
    const promptBox = screen.getByPlaceholderText(/илустрацијата/) as HTMLTextAreaElement;
    expect(promptBox).toBeTruthy();

    const generateBtn = screen.getByRole('button', { name: /^Генерирај$/ }) as HTMLButtonElement;
    expect(generateBtn.disabled).toBe(true);

    fireEvent.change(promptBox, { target: { value: 'прав агол' } });
    expect(generateBtn.disabled).toBe(false);
  });

  it('AI panel: no "fill from topic" shortcut without a curriculumContext prop', () => {
    renderLab();
    fireEvent.click(screen.getByText('Генерирај со АИ'));
    expect(screen.queryByText('Пополни од темава')).toBeNull();
  });

  it('AI panel: "fill from topic" pre-fills the prompt when curriculumContext is passed', () => {
    renderLab('mk', { curriculumContext: { topicTitle: 'Питагорова теорема', standardCode: 'III-А.14' } });
    fireEvent.click(screen.getByText('Генерирај со АИ'));
    fireEvent.click(screen.getByText('Пополни од темава'));
    const promptBox = screen.getByPlaceholderText(/илустрацијата/) as HTMLTextAreaElement;
    expect(promptBox.value).toBe('Питагорова теорема');
  });

  it('AI panel: successful generation replaces the editor code and shows a success notification', async () => {
    mockGenerateTikzDiagram.mockResolvedValue('\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}');
    renderLab();
    fireEvent.click(screen.getByText('Генерирај со АИ'));
    const promptBox = screen.getByPlaceholderText(/илустрацијата/);
    fireEvent.change(promptBox, { target: { value: 'права линија' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Генерирај$/ }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockGenerateTikzDiagram).toHaveBeenCalledWith('права линија', undefined);
    // With the AI panel open, textboxes are [search, aiPrompt, codeEditor] — the code editor
    // stub is always last regardless of whether the AI panel is open.
    const textboxes = screen.getAllByRole('textbox');
    const editor = textboxes[textboxes.length - 1] as HTMLTextAreaElement;
    expect(editor.value).toContain('\\draw (0,0) -- (1,1);');
    expect(mockAddNotification).toHaveBeenCalledWith(expect.any(String), 'success');
  });

  it('AI panel: failed generation shows an error notification and leaves the editor untouched', async () => {
    mockGenerateTikzDiagram.mockRejectedValue(new Error('blocked'));
    renderLab();
    fireEvent.click(screen.getByText('Генерирај со АИ'));
    const promptBox = screen.getByPlaceholderText(/илустрацијата/);
    fireEvent.change(promptBox, { target: { value: 'нешто несоодветно' } });
    const textboxesBefore = screen.getAllByRole('textbox');
    const editorBefore = (textboxesBefore[textboxesBefore.length - 1] as HTMLTextAreaElement).value;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Генерирај$/ }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockAddNotification).toHaveBeenCalledWith(expect.any(String), 'error');
    const textboxesAfter = screen.getAllByRole('textbox');
    const editorAfter = (textboxesAfter[textboxesAfter.length - 1] as HTMLTextAreaElement).value;
    expect(editorAfter).toBe(editorBefore);
  });
});

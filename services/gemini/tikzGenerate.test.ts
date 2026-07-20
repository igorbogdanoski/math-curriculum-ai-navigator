import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallGeminiProxy = vi.fn();
const mockScanString = vi.fn();

vi.mock('./core', () => ({
  callGeminiProxy: (...args: unknown[]) => mockCallGeminiProxy(...args),
  DEFAULT_MODEL: 'gemini-3.5-flash',
  sanitizePromptInput: (s: string | undefined | null) => (s ?? '').trim(),
}));

vi.mock('../../utils/contentModeration', () => ({
  scanString: (...args: unknown[]) => mockScanString(...args),
}));

const { generateTikzDiagram } = await import('./tikzGenerate');

describe('generateTikzDiagram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScanString.mockReturnValue({ ok: true });
    mockCallGeminiProxy.mockResolvedValue({
      text: '\\begin{tikzpicture}\n\\draw (0,0) -- (1,1);\n\\end{tikzpicture}',
    });
  });

  it('calls callGeminiProxy with the ILLUSTRATION costKey (not the default TEXT_BASIC)', async () => {
    await generateTikzDiagram('прав агол');
    expect(mockCallGeminiProxy).toHaveBeenCalledOnce();
    const [config] = mockCallGeminiProxy.mock.calls[0];
    expect(config.costKey).toBe('ILLUSTRATION');
  });

  it('moderates the prompt before calling the AI, and blocks on a failed scan', async () => {
    mockScanString.mockReturnValue({ ok: false, reason: 'profanity' });
    await expect(generateTikzDiagram('bad prompt')).rejects.toThrow();
    expect(mockCallGeminiProxy).not.toHaveBeenCalled();
  });

  it('extracts the tikzpicture block even if the model wraps it in markdown', async () => {
    mockCallGeminiProxy.mockResolvedValue({
      text: '```latex\n\\usetikzlibrary{calc}\n\\begin{tikzpicture}\n\\draw (0,0) circle (1);\n\\end{tikzpicture}\n```',
    });
    const result = await generateTikzDiagram('circle');
    expect(result).toContain('\\begin{tikzpicture}');
    expect(result).toContain('\\end{tikzpicture}');
    expect(result).not.toContain('```');
  });

  it('throws when the model response has no tikzpicture block', async () => {
    mockCallGeminiProxy.mockResolvedValue({ text: 'Sorry, I cannot help with that.' });
    await expect(generateTikzDiagram('circle')).rejects.toThrow();
  });

  it('includes curriculum context (topic + standard) in the prompt when provided', async () => {
    await generateTikzDiagram('прав агол', { topicTitle: 'Геометрија', standardCode: 'III-А.12' });
    const [config] = mockCallGeminiProxy.mock.calls[0];
    const promptText: string = config.contents[0].parts[0].text;
    expect(promptText).toContain('Геометрија');
    expect(promptText).toContain('III-А.12');
  });

  it('omits curriculum context from the prompt when not provided', async () => {
    await generateTikzDiagram('прав агол');
    const [config] = mockCallGeminiProxy.mock.calls[0];
    const promptText: string = config.contents[0].parts[0].text;
    expect(promptText).not.toContain('curriculum topic');
  });

  it('system instruction forbids Cyrillic labels and restricts tikz libraries', async () => {
    await generateTikzDiagram('прав агол');
    const [config] = mockCallGeminiProxy.mock.calls[0];
    expect(config.systemInstruction).toMatch(/Cyrillic/i);
    expect(config.systemInstruction).toContain('angles, quotes, calc, intersections');
  });
});

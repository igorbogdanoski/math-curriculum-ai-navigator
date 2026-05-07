import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { GlossaryPopover } from './GlossaryPopover';
import { QuestionGlossaryStrip } from './QuestionGlossaryStrip';
import { getGlossaryEntry } from '../../data/mathGlossary';

describe('GlossaryPopover', () => {
  afterEach(cleanup);

  const entry = getGlossaryEntry('дискриминанта')!;

  it('renders trigger chip with the term label', () => {
    const { getByTestId } = render(<GlossaryPopover entry={entry} />);
    expect(getByTestId('glossary-trigger-дискриминанта')).toBeTruthy();
  });

  it('shows definition on click', () => {
    const { getByTestId, queryByTestId } = render(<GlossaryPopover entry={entry} />);
    expect(queryByTestId('glossary-content-дискриминанта')).toBeNull();
    fireEvent.click(getByTestId('glossary-trigger-дискриминанта'));
    const content = getByTestId('glossary-content-дискриминанта');
    expect(content.textContent).toContain('D = b²');
  });

  it('toggles closed on second click', () => {
    const { getByTestId, queryByTestId } = render(<GlossaryPopover entry={entry} />);
    const trigger = getByTestId('glossary-trigger-дискриминанта');
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(queryByTestId('glossary-content-дискриминанта')).toBeNull();
  });

  it('honours custom label override', () => {
    const { getByTestId } = render(<GlossaryPopover entry={entry} label="Дискр." />);
    expect(getByTestId('glossary-trigger-дискриминанта').textContent).toContain('Дискр.');
  });
});

describe('QuestionGlossaryStrip', () => {
  afterEach(cleanup);

  it('renders nothing for text without terms', () => {
    const { queryByTestId } = render(<QuestionGlossaryStrip text="Едно две три." />);
    expect(queryByTestId('question-glossary-strip')).toBeNull();
  });

  it('renders chip per detected term', () => {
    const { getByTestId, getAllByTestId } = render(
      <QuestionGlossaryStrip text="Изводот на функцијата и нејзината асимптота." />,
    );
    expect(getByTestId('question-glossary-strip')).toBeTruthy();
    const chips = getAllByTestId(/^glossary-trigger-/);
    expect(chips.length).toBeGreaterThanOrEqual(2);
  });
});

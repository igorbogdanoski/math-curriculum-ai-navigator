/**
 * S61-A2 — Tests for the per-question teacher controls panel.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import {
  S61TeacherControls,
  isOpenEndedType,
} from '../components/dugga/S61TeacherControls';
import type { DuggaQuestion } from '../services/firestoreService.dugga';

function makeQ(patch: Partial<DuggaQuestion> = {}): DuggaQuestion {
  return {
    id: 'q1',
    type: 'essay',
    text: 'Sample',
    dok: 2,
    points: 5,
    ...patch,
  };
}

describe('isOpenEndedType', () => {
  it('returns true for open-ended types', () => {
    expect(isOpenEndedType('essay')).toBe(true);
    expect(isOpenEndedType('short_answer')).toBe(true);
    expect(isOpenEndedType('fill_blanks')).toBe(true);
    expect(isOpenEndedType('multi_part')).toBe(true);
    expect(isOpenEndedType('list_items')).toBe(true);
  });
  it('returns false for closed types', () => {
    expect(isOpenEndedType('multiple_choice')).toBe(false);
    expect(isOpenEndedType('true_false')).toBe(false);
    expect(isOpenEndedType('section_header')).toBe(false);
  });
});

describe('S61TeacherControls', () => {
  it('renders collapsed by default', () => {
    const onChange = vi.fn();
    render(<S61TeacherControls q={makeQ()} onChange={onChange} />);
    expect(screen.getByTestId('s61-teacher-controls')).toBeTruthy();
    expect(screen.queryByTestId('s61-allow-qr')).toBeNull();
  });

  it('expands when toggle is clicked and shows core controls', () => {
    const onChange = vi.fn();
    render(<S61TeacherControls q={makeQ()} onChange={onChange} defaultOpen />);
    expect(screen.getByTestId('s61-allow-qr')).toBeTruthy();
    expect(screen.getByTestId('s61-embed-tool')).toBeTruthy();
    expect(screen.getByTestId('s61-answer-input')).toBeTruthy();
    expect(screen.getByTestId('s61-drawing-mode')).toBeTruthy();
    expect(screen.getByTestId('s61-concept-ids')).toBeTruthy();
  });

  it('emits allowSolutionUpload patch when QR checkbox toggled', () => {
    const onChange = vi.fn();
    render(<S61TeacherControls q={makeQ()} onChange={onChange} defaultOpen />);
    fireEvent.click(screen.getByTestId('s61-allow-qr'));
    expect(onChange).toHaveBeenCalledWith({ allowSolutionUpload: true });
  });

  it('emits embedTool patch and reveals embed config fields', () => {
    const onChange = vi.fn();
    const { rerender } = render(<S61TeacherControls q={makeQ()} onChange={onChange} defaultOpen />);
    expect(screen.queryByTestId('s61-embed-material')).toBeNull();

    fireEvent.change(screen.getByTestId('s61-embed-tool'), {
      target: { value: 'geogebra-cas' },
    });
    expect(onChange).toHaveBeenCalledWith({ embedTool: 'geogebra-cas' });

    rerender(
      <S61TeacherControls
        q={makeQ({ embedTool: 'geogebra-cas' })}
        onChange={onChange}
        defaultOpen
      />,
    );
    expect(screen.getByTestId('s61-embed-material')).toBeTruthy();
    expect(screen.getByTestId('s61-embed-height')).toBeTruthy();
    expect(screen.getByTestId('s61-embed-persist')).toBeTruthy();
  });

  it('parses linked concept IDs from a comma-separated string', () => {
    const onChange = vi.fn();
    render(<S61TeacherControls q={makeQ()} onChange={onChange} defaultOpen />);
    fireEvent.change(screen.getByTestId('s61-concept-ids'), {
      target: { value: ' concept.a , concept.b ,  ' },
    });
    expect(onChange).toHaveBeenCalledWith({
      linkedConceptIds: ['concept.a', 'concept.b'],
    });
  });

  it('emits answerInput + studentDrawingMode patches', () => {
    const onChange = vi.fn();
    render(<S61TeacherControls q={makeQ()} onChange={onChange} defaultOpen />);
    fireEvent.change(screen.getByTestId('s61-answer-input'), {
      target: { value: 'math' },
    });
    expect(onChange).toHaveBeenCalledWith({ answerInput: 'math' });

    fireEvent.change(screen.getByTestId('s61-drawing-mode'), {
      target: { value: 'bar-chart' },
    });
    expect(onChange).toHaveBeenCalledWith({ studentDrawingMode: 'bar-chart' });
  });
});

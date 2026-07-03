import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLabSession } from './useLabSession';
import type { LabExercise } from '../types/labTypes';
import { firestoreService } from '../services/firestoreService';

vi.mock('../services/firestoreService', () => ({
  firestoreService: { saveQuizResult: vi.fn().mockResolvedValue('doc-id') },
}));

const EX1: LabExercise = {
  id: 'e1', question: 'V-E+F=?', type: 'numeric', correctAnswer: '2',
  hint: 'Ojler', explanation: 'Ojlerova formula', difficulty: 1, curriculumRef: 'МОН VII',
};
const EX2: LabExercise = {
  id: 'e2', question: 'Kolku lica ima kuba?', type: 'numeric', correctAnswer: '6',
  hint: '6 kvadratni lica', explanation: '6 lica', difficulty: 1, curriculumRef: 'МОН VII',
};

function twoExerciseSet(): LabExercise[] {
  return [EX1, EX2];
}

describe('useLabSession', () => {
  beforeEach(() => {
    vi.mocked(firestoreService.saveQuizResult).mockClear();
  });

  it('starts with no exercises loaded', () => {
    const { result } = renderHook(() => useLabSession('geometry-3d', '3D Геометрија'));
    expect(result.current.exercises).toHaveLength(0);
    expect(result.current.currentEx).toBeNull();
    expect(result.current.labId).toBe('geometry-3d');
  });

  it('loadExercises resets score, index, and per-question state', () => {
    const { result } = renderHook(() => useLabSession('geometry-3d', '3D Геометрија'));
    act(() => result.current.loadExercises(twoExerciseSet()));
    expect(result.current.exercises).toHaveLength(2);
    expect(result.current.currentIdx).toBe(0);
    expect(result.current.score).toBe(0);
    expect(result.current.sessionDone).toBe(false);
    expect(result.current.currentEx).toEqual(EX1);
  });

  it('submitAnswer with a correct answer increments score and streak', () => {
    const { result } = renderHook(() => useLabSession('geometry-3d', '3D Геометрија'));
    act(() => result.current.loadExercises(twoExerciseSet()));
    act(() => result.current.setUserAnswer('2'));
    act(() => result.current.submitAnswer());

    expect(result.current.correct).toBe(true);
    expect(result.current.submitted).toBe(true);
    expect(result.current.score).toBe(1);
    expect(result.current.correctHistory).toEqual([true]);
    expect(result.current.difficultyStreak).toEqual({ correct: 1, wrong: 0 });
  });

  it('submitAnswer with a wrong answer resets the correct streak', () => {
    const { result } = renderHook(() => useLabSession('geometry-3d', '3D Геометрија'));
    act(() => result.current.loadExercises(twoExerciseSet()));
    act(() => result.current.setUserAnswer('99'));
    act(() => result.current.submitAnswer());

    expect(result.current.correct).toBe(false);
    expect(result.current.score).toBe(0);
    expect(result.current.correctHistory).toEqual([false]);
    expect(result.current.difficultyStreak).toEqual({ correct: 0, wrong: 1 });
  });

  it('submitAnswer is a no-op once already submitted (no double count)', () => {
    const { result } = renderHook(() => useLabSession('geometry-3d', '3D Геометрија'));
    act(() => result.current.loadExercises(twoExerciseSet()));
    act(() => result.current.setUserAnswer('2'));
    act(() => result.current.submitAnswer());
    act(() => result.current.submitAnswer()); // second call should be ignored

    expect(result.current.score).toBe(1);
    expect(result.current.correctHistory).toEqual([true]);
  });

  it('useHint increments hintsUsed and shows the hint, but not after submission', () => {
    const { result } = renderHook(() => useLabSession('geometry-3d', '3D Геометрија'));
    act(() => result.current.loadExercises(twoExerciseSet()));
    act(() => result.current.useHint());
    expect(result.current.hintsUsed).toBe(1);
    expect(result.current.showHint).toBe(true);

    act(() => result.current.setUserAnswer('2'));
    act(() => result.current.submitAnswer());
    act(() => result.current.useHint()); // submitted — should not add another hint
    expect(result.current.hintsUsed).toBe(1);
  });

  it('nextExercise advances to the next question and clears per-question state', () => {
    const { result } = renderHook(() => useLabSession('geometry-3d', '3D Геометрија'));
    act(() => result.current.loadExercises(twoExerciseSet()));
    act(() => result.current.setUserAnswer('2'));
    act(() => result.current.submitAnswer());
    act(() => result.current.nextExercise());

    expect(result.current.currentIdx).toBe(1);
    expect(result.current.currentEx).toEqual(EX2);
    expect(result.current.submitted).toBe(false);
    expect(result.current.userAnswer).toBe('');
    expect(result.current.sessionDone).toBe(false);
  });

  it('nextExercise on the last question marks the session done', () => {
    const { result } = renderHook(() => useLabSession('geometry-3d', '3D Геометрија'));
    act(() => result.current.loadExercises(twoExerciseSet()));
    act(() => result.current.setUserAnswer('2'));
    act(() => result.current.submitAnswer());
    act(() => result.current.nextExercise()); // -> index 1
    act(() => result.current.setUserAnswer('6'));
    act(() => result.current.submitAnswer());
    act(() => result.current.nextExercise()); // past last -> done

    expect(result.current.sessionDone).toBe(true);
    expect(result.current.score).toBe(2);
  });

  it('resetSession replays the same exercise set from the start', () => {
    const { result } = renderHook(() => useLabSession('geometry-3d', '3D Геометрија'));
    act(() => result.current.loadExercises(twoExerciseSet()));
    act(() => result.current.setUserAnswer('2'));
    act(() => result.current.submitAnswer());
    act(() => result.current.resetSession());

    expect(result.current.currentIdx).toBe(0);
    expect(result.current.score).toBe(0);
    expect(result.current.exercises).toHaveLength(2);
    expect(result.current.correctHistory).toEqual([]);
  });

  it('saveSession writes quizType "lab", conceptId=labId, and the set difficulty to Firestore', async () => {
    const { result } = renderHook(() => useLabSession('geometry-3d', '3D Геометрија'));
    act(() => result.current.loadExercises(twoExerciseSet()));
    act(() => result.current.setUserAnswer('2'));
    act(() => result.current.submitAnswer());

    await act(async () => { await result.current.saveSession('Ана'); });

    expect(firestoreService.saveQuizResult).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(firestoreService.saveQuizResult).mock.calls[0][0];
    expect(payload.quizType).toBe('lab');
    expect(payload.conceptId).toBe('geometry-3d');
    expect(payload.studentName).toBe('Ана');
    expect(payload.totalQuestions).toBe(2);
    expect(payload.score).toBe(1);
    expect(payload.percentage).toBe(50);
    expect(payload.difficulty).toBe(1); // derived from exercises[0].difficulty
  });

  it('saveSession does nothing for a blank student name', async () => {
    const { result } = renderHook(() => useLabSession('geometry-3d', '3D Геометрија'));
    act(() => result.current.loadExercises(twoExerciseSet()));

    await act(async () => { await result.current.saveSession('   '); });

    expect(firestoreService.saveQuizResult).not.toHaveBeenCalled();
  });
});

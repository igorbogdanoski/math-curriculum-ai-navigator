import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { computeCoverage, BROCoveragePanel } from './BROCoveragePanel';
import { GradeEntry } from '../../types';

// ── computeCoverage unit tests ────────────────────────────────────────────────

function makeEntry(standardScores?: Record<string, 1 | 2 | 3 | 4>): GradeEntry {
  return {
    studentId: crypto.randomUUID(),
    studentName: 'Тест Ученик',
    testId: crypto.randomUUID(),
    testTitle: 'Тест 1',
    rawScore: 80,
    maxScore: 100,
    percentage: 80,
    masteryStatus: 'mastered',
    gradedAt: new Date().toISOString(),
    standardScores,
  };
}

describe('computeCoverage', () => {
  it('returns empty map when no entries', () => {
    expect(computeCoverage([])).toEqual(new Map());
  });

  it('returns empty map when entries have no standardScores', () => {
    const entries = [makeEntry(undefined), makeEntry(undefined)];
    expect(computeCoverage(entries).size).toBe(0);
  });

  it('aggregates single entry correctly', () => {
    const entries = [makeEntry({ 'III-А.1': 3 })];
    const map = computeCoverage(entries);
    expect(map.get('III-А.1')).toEqual({ sum: 3, count: 1 });
  });

  it('aggregates multiple entries for same standard', () => {
    const entries = [
      makeEntry({ 'III-А.1': 4 }),
      makeEntry({ 'III-А.1': 2 }),
    ];
    const map = computeCoverage(entries);
    expect(map.get('III-А.1')).toEqual({ sum: 6, count: 2 });
  });

  it('aggregates multiple standards independently', () => {
    const entries = [
      makeEntry({ 'III-А.1': 4, 'III-А.2': 2 }),
      makeEntry({ 'III-А.1': 2, 'III-А.3': 3 }),
    ];
    const map = computeCoverage(entries);
    expect(map.get('III-А.1')).toEqual({ sum: 6, count: 2 });
    expect(map.get('III-А.2')).toEqual({ sum: 2, count: 1 });
    expect(map.get('III-А.3')).toEqual({ sum: 3, count: 1 });
  });

  it('skips entries without standardScores', () => {
    const entries = [
      makeEntry({ 'III-А.5': 4 }),
      makeEntry(undefined),
      makeEntry({ 'III-А.5': 2 }),
    ];
    const map = computeCoverage(entries);
    expect(map.get('III-А.5')).toEqual({ sum: 6, count: 2 });
    expect(map.size).toBe(1);
  });
});

// ── BROCoveragePanel render tests ─────────────────────────────────────────────

describe('BROCoveragePanel', () => {
  it('shows "not applicable" for secondary grades', () => {
    render(<BROCoveragePanel entries={[makeEntry()]} gradeLevel={10} />);
    expect(screen.getByText(/само за основно образование/i)).toBeTruthy();
  });

  it('shows empty state when no standardScores in entries', () => {
    render(<BROCoveragePanel entries={[makeEntry(undefined)]} gradeLevel={8} />);
    expect(screen.getByText(/Нема поврзани БРО стандарди/)).toBeTruthy();
  });

  it('shows standards grid when entries have standardScores', () => {
    const entries = [makeEntry({ 'III-А.1': 4 })];
    render(<BROCoveragePanel entries={entries} gradeLevel={8} />);
    expect(screen.getAllByText(/III-А\.1/).length).toBeGreaterThan(0);
  });

  it('shows covered count in summary', () => {
    const entries = [makeEntry({ 'III-А.1': 4, 'III-А.2': 2 })];
    render(<BROCoveragePanel entries={entries} gradeLevel={8} />);
    expect(screen.getByText(/Покриени стандарди/)).toBeTruthy();
    expect(screen.getByText(/2\//)).toBeTruthy();
  });

  it('shows gap alert when avg < 2', () => {
    const entries = [
      makeEntry({ 'III-А.5': 1 }),
      makeEntry({ 'III-А.5': 1 }),
    ];
    render(<BROCoveragePanel entries={entries} gradeLevel={8} />);
    expect(screen.getByText(/стандарди под 2.0/)).toBeTruthy();
    expect(screen.getByText(/Стандарди кои бараат интервенција/)).toBeTruthy();
  });

  it('shows average score for covered standards', () => {
    const entries = [makeEntry({ 'III-А.3': 4 })];
    render(<BROCoveragePanel entries={entries} gradeLevel={9} />);
    expect(screen.getByText('4.0')).toBeTruthy();
  });

  it('shows dash for uncovered standards', () => {
    const entries = [makeEntry({ 'III-А.1': 3 })];
    render(<BROCoveragePanel entries={entries} gradeLevel={7} />);
    // Many standards have no data → many "—" dashes
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(10);
  });
});

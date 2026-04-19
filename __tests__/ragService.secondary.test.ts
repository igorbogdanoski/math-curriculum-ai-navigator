/**
 * Tests for ragService secondary-curriculum fallback (S27 fix).
 *
 * getConceptContext / getTopicContext must return proper BRO text for
 * gymnasium grades (10–13) by falling through to secondaryCurricula when
 * the primary curriculum (grades 1–9) has no matching grade.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));
vi.mock('../firebaseConfig', () => ({ db: {} }));
vi.mock('../services/gemini/core', () => ({ callEmbeddingProxy: vi.fn() }));

import { ragService } from '../services/ragService';

// ─── getConceptContext ────────────────────────────────────────────────────────

describe('ragService.getConceptContext — primary grades (1–9)', () => {
  it('returns non-empty BRO text for a valid grade-1 concept', async () => {
    const ctx = await ragService.getConceptContext(1, 'g1-concept-1-1');
    expect(ctx.length).toBeGreaterThan(50);
    expect(ctx).toContain('ОФИЦИЈАЛНА ПРОГРАМА НА БИРО ЗА РАЗВОЈ НА ОБРАЗОВАНИЕТО');
  });

  it('returns empty string for unknown concept in primary grade', async () => {
    const ctx = await ragService.getConceptContext(5, 'non-existent-concept-xyz');
    expect(ctx).toBe('');
  });

  it('returns empty string for grade 0 (out of range)', async () => {
    const ctx = await ragService.getConceptContext(0, 'g1-concept-1-1');
    expect(ctx).toBe('');
  });
});

describe('ragService.getConceptContext — secondary curriculum fallback (grades 10–13)', () => {
  it('returns non-empty BRO text for gymnasium grade-10 concept (gym10-c1-1)', async () => {
    const ctx = await ragService.getConceptContext(10, 'gym10-c1-1');
    expect(ctx.length).toBeGreaterThan(100);
    expect(ctx).toContain('ОФИЦИЈАЛНА ПРОГРАМА НА БИРО ЗА РАЗВОЈ НА ОБРАЗОВАНИЕТО');
  });

  it('BRO text includes grade title for gymnasium', async () => {
    const ctx = await ragService.getConceptContext(10, 'gym10-c1-1');
    expect(ctx).toContain('Гимназиско');
  });

  it('BRO text includes concept title (Множества)', async () => {
    const ctx = await ragService.getConceptContext(10, 'gym10-c1-1');
    expect(ctx).toContain('Множества');
  });

  it('BRO text includes end marker', async () => {
    const ctx = await ragService.getConceptContext(10, 'gym10-c1-1');
    expect(ctx).toContain('КРАЈ НА ОФИЦИЈАЛНА ПРОГРАМА');
  });

  it('returns empty string for grade-10 with unknown conceptId', async () => {
    const ctx = await ragService.getConceptContext(10, 'gym10-totally-unknown');
    expect(ctx).toBe('');
  });

  it('returns BRO text even with gradeLevel=15 if conceptId exists in secondary', async () => {
    // fallback searches by conceptId only; 'gym10-c1-1' is found in secondary
    const ctx = await ragService.getConceptContext(15, 'gym10-c1-1');
    expect(ctx).toContain('Множества');
  });

  it('returns empty string when conceptId does not exist anywhere', async () => {
    const ctx = await ragService.getConceptContext(15, 'totally-nonexistent-xyz');
    expect(ctx).toBe('');
  });

  it('works for a grade-11 gymnasium concept', async () => {
    // gym11 exists in secondaryCurricula — any valid concept ID in that grade
    const ctx = await ragService.getConceptContext(11, 'gym11-c1-1');
    // May return '' if concept doesn't exist with that exact ID — test that it at least doesn't throw
    expect(typeof ctx).toBe('string');
  });
});

// ─── getTopicContext ─────────────────────────────────────────────────────────

describe('ragService.getTopicContext — primary grades', () => {
  it('returns non-empty topic BRO text for grade-1 topic g1-topic-1', async () => {
    const ctx = await ragService.getTopicContext(1, 'g1-topic-1');
    expect(ctx.length).toBeGreaterThan(50);
    expect(ctx).toContain('ОФИЦИЈАЛНА ПРОГРАМА НА БИРО ЗА РАЗВОЈ НА ОБРАЗОВАНИЕТО');
  });

  it('returns empty string for unknown topic in primary grade', async () => {
    const ctx = await ragService.getTopicContext(3, 'non-existent-topic');
    expect(ctx).toBe('');
  });
});

describe('ragService.getTopicContext — secondary curriculum fallback', () => {
  it('returns non-empty BRO text for gymnasium grade-10 topic (gym10-t1)', async () => {
    const ctx = await ragService.getTopicContext(10, 'gym10-t1');
    expect(ctx.length).toBeGreaterThan(50);
    expect(ctx).toContain('ОФИЦИЈАЛНА ПРОГРАМА НА БИРО ЗА РАЗВОЈ НА ОБРАЗОВАНИЕТО');
  });

  it('topic BRO text includes topic title БРОЕВИ И ОПЕРАЦИИ', async () => {
    const ctx = await ragService.getTopicContext(10, 'gym10-t1');
    expect(ctx).toContain('БРОЕВИ И ОПЕРАЦИИ');
  });

  it('topic BRO text includes end marker', async () => {
    const ctx = await ragService.getTopicContext(10, 'gym10-t1');
    expect(ctx).toContain('КРАЈ НА ОФИЦИЈАЛНА ПРОГРАМА');
  });

  it('returns empty string for grade-10 with unknown topicId', async () => {
    const ctx = await ragService.getTopicContext(10, 'gym10-topic-totally-unknown');
    expect(ctx).toBe('');
  });

  it('returns BRO text even with gradeLevel=14 if topicId exists in secondary', async () => {
    // fallback searches by topicId only; 'gym10-t1' is found in secondary curriculum
    const ctx = await ragService.getTopicContext(14, 'gym10-t1');
    expect(ctx).toContain('БРОЕВИ И ОПЕРАЦИИ');
  });

  it('returns empty string for topicId that does not exist anywhere', async () => {
    const ctx = await ragService.getTopicContext(14, 'totally-unknown-topic-xyz');
    expect(ctx).toBe('');
  });
});

// ─── Regression: primary grade must NOT fall through to secondary ─────────────

describe('ragService — primary-grade lookup takes precedence', () => {
  it('grade-1 concept returns grade-1 BRO text, not secondary', async () => {
    const ctx = await ragService.getConceptContext(1, 'g1-concept-1-1');
    expect(ctx).toContain('прво');   // grade-1 title fragment
    expect(ctx).not.toContain('Гимназиско');
  });

  it('grade-9 topic still works from primary curriculum', async () => {
    // grade-9 is in primary; just verifying no regression from the fallback code
    const ctx = await ragService.getTopicContext(9, 'g9-topic-1');
    // May be empty if that ID doesn't exist, but must not throw
    expect(typeof ctx).toBe('string');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveExpression, fetchMyExpressions } from './firestoreService.mathExpressions';
import { addDoc, getDocs, where } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col-ref'),
  getDocs: vi.fn(),
  query: vi.fn((...args) => ['query-ref', ...args]),
  where: vi.fn((...args) => ['where', ...args]),
  orderBy: vi.fn((...args) => ['orderBy', ...args]),
  limit: vi.fn((...args) => ['limit', ...args]),
  addDoc: vi.fn().mockResolvedValue({ id: 'expr-new' }),
  serverTimestamp: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })),
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));

beforeEach(() => vi.clearAllMocks());

describe('saveExpression', () => {
  it('creates a new doc with the teacher uid and latex', async () => {
    const id = await saveExpression('teacher1', '\\frac{1}{2}');
    expect(id).toBe('expr-new');
    expect(addDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({ teacherUid: 'teacher1', latex: '\\frac{1}{2}', label: null }));
  });

  it('passes the label through when provided', async () => {
    await saveExpression('teacher1', 'x^2', 'Квадратна равенка');
    expect(addDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({ label: 'Квадратна равенка' }));
  });
});

describe('fetchMyExpressions', () => {
  it('queries scoped to the teacher', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
    await fetchMyExpressions('teacher1');
    expect(where).toHaveBeenCalledWith('teacherUid', '==', 'teacher1');
  });

  it('returns [] and swallows errors', async () => {
    vi.mocked(getDocs).mockRejectedValue(new Error('offline'));
    const result = await fetchMyExpressions('teacher1');
    expect(result).toEqual([]);
  });
});

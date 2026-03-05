/**
 * Daily Quest logic — pure, no Firebase dependencies, fully testable.
 * Quests are persisted in localStorage, keyed by studentName + date.
 */

export interface DailyQuest {
  conceptId: string;
  conceptTitle: string;
  difficulty: 'easy' | 'medium' | 'hard';
  completed: boolean;
}

export const QUEST_META: Record<DailyQuest['difficulty'], { icon: string; label: string; color: string }> = {
  easy:   { icon: '🟢', label: 'Повтори',    color: 'green'  },
  medium: { icon: '🟡', label: 'Вежбај',     color: 'yellow' },
  hard:   { icon: '🔴', label: 'Предизвик',  color: 'red'    },
};

interface ConceptLike { id: string; title: string; priorKnowledgeIds?: string[] }
interface MasteryLike { conceptId: string; mastered: boolean }

/** Pick a random element from array, or null if empty. */
function pick<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates 3 daily quests based on mastery data:
 *  - easy:   mastered concept to review (spaced repetition)
 *  - medium: in-progress concept (not yet mastered)
 *  - hard:   not-started concept whose prerequisites are all mastered
 */
export function generateDailyQuests(
  allConcepts: ConceptLike[],
  masteryRecords: MasteryLike[],
): DailyQuest[] {
  const masteryMap = new Map(masteryRecords.map(m => [m.conceptId, m]));
  const masteredIds = new Set(masteryRecords.filter(m => m.mastered).map(m => m.conceptId));

  const mastered    = allConcepts.filter(c => masteredIds.has(c.id));
  const inProgress  = allConcepts.filter(c => { const m = masteryMap.get(c.id); return m && !m.mastered; });
  const notStarted  = allConcepts.filter(c => {
    if (masteryMap.has(c.id)) return false;
    return (c.priorKnowledgeIds ?? []).every(pid => masteredIds.has(pid));
  });

  const chosen = new Set<string>();
  const quests: DailyQuest[] = [];

  const addQuest = (c: ConceptLike | null, difficulty: DailyQuest['difficulty']) => {
    if (!c || chosen.has(c.id)) return;
    chosen.add(c.id);
    quests.push({ conceptId: c.id, conceptTitle: c.title, difficulty, completed: false });
  };

  // Easy — mastered concept for review, fallback to in-progress
  addQuest(pick(mastered) ?? pick(inProgress), 'easy');

  // Medium — in-progress, not already chosen, fallback to mastered
  addQuest(
    pick(inProgress.filter(c => !chosen.has(c.id))) ?? pick(mastered.filter(c => !chosen.has(c.id))),
    'medium',
  );

  // Hard — not-started with prereqs met, fallback to any not chosen
  addQuest(
    pick(notStarted.filter(c => !chosen.has(c.id))) ??
    pick(allConcepts.filter(c => !chosen.has(c.id))),
    'hard',
  );

  return quests;
}

const storageKey = (name: string, date: string) => `daily_quests_${name}_${date}`;

export function getTodayStr(): string {
  return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
}

/**
 * Returns today's quests from localStorage, generating new ones if needed.
 * Safe to call on every render — reads from cache after first call.
 */
export function loadOrGenerateQuests(
  studentName: string,
  allConcepts: ConceptLike[],
  masteryRecords: MasteryLike[],
): DailyQuest[] {
  if (!studentName || allConcepts.length === 0) return [];
  const key = storageKey(studentName, getTodayStr());
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as DailyQuest[];
  } catch { /* ignore parse errors */ }

  const quests = generateDailyQuests(allConcepts, masteryRecords);
  try { localStorage.setItem(key, JSON.stringify(quests)); } catch { /* quota exceeded */ }
  return quests;
}

/**
 * Marks a quest for the given conceptId as completed for today.
 * No-op if the quest doesn't exist.
 */
export function markQuestComplete(studentName: string, conceptId: string): void {
  if (!studentName) return;
  const key = storageKey(studentName, getTodayStr());
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return;
    const quests: DailyQuest[] = JSON.parse(stored);
    const updated = quests.map(q => q.conceptId === conceptId ? { ...q, completed: true } : q);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch { /* ignore */ }
}

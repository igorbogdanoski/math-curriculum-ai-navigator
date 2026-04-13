import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { QuizResult } from './firestoreService';
import { logger } from '../utils/logger';

interface MathNavDB extends DBSchema {
  pending_quizzes: {
    key: string;
    value: {
      id: string; // generated offline UUID
      quizResult: QuizResult;
      timestamp: number;
    };
  };
  ai_cache: {
    key: string;
    value: {
      id: string;
      content: any;
      timestamp: number;
    };
  };
  quiz_content_cache: {
    key: string;
    value: {
      id: string; // cacheId from Firestore
      content: any; // full material content
      timestamp: number;
    };
  };
}

const DB_NAME = 'MathNavOfflineDB';
const DB_VERSION = 3;

const AI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;   // 24 h
const QUIZ_CACHE_TTL_MS_CLEANUP = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Р3-В: Remove expired ai_cache + quiz_content_cache entries.
 * Incremental: deletes at most MAX_PER_TICK entries per store per call,
 * then yields via requestIdleCallback/setTimeout to avoid blocking the main thread.
 * Safe to call on mobile with limited IndexedDB quota.
 */
const MAX_PER_TICK = 100;

export async function cleanupExpiredCache(): Promise<void> {
  try {
    const db = await getDbPromise();
    const now = Date.now();

    // Helper: delete up to MAX_PER_TICK expired entries from a store
    const cleanStore = async (
      store: 'ai_cache' | 'quiz_content_cache',
      ttl: number,
    ): Promise<void> => {
      const keys = await db.getAllKeys(store);
      let deleted = 0;
      for (const key of keys) {
        if (deleted >= MAX_PER_TICK) break;
        const entry = await db.get(store, key);
        if (entry && now - entry.timestamp > ttl) {
          await db.delete(store, key);
          deleted++;
        }
      }
    };

    // Yield to the browser between store cleanups
    await cleanStore('ai_cache', AI_CACHE_TTL_MS);
    await new Promise<void>(resolve => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
    await cleanStore('quiz_content_cache', QUIZ_CACHE_TTL_MS_CLEANUP);
  } catch {
    // non-fatal — cleanup is best-effort
  }
}

let dbPromise: Promise<IDBPDatabase<MathNavDB>> | null = null;

// Internal getter used by cleanupExpiredCache (avoids circular ref with initDB)
function getDbPromise(): Promise<IDBPDatabase<MathNavDB>> {
  return initDB();
}

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<MathNavDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('pending_quizzes')) {
          db.createObjectStore('pending_quizzes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('ai_cache')) {
          db.createObjectStore('ai_cache', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('quiz_content_cache')) {
          db.createObjectStore('quiz_content_cache', { keyPath: 'id' });
        }
        // v3 migration: schedule stale-entry cleanup on next tick
        if (oldVersion < 3) {
          setTimeout(() => cleanupExpiredCache().catch(() => {}), 0);
        }
      },
    });
  }
  return dbPromise;
};

export const saveQuizOffline = async (quizResult: QuizResult): Promise<string> => {
  const db = await initDB();
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  
  await db.add('pending_quizzes', {
    id,
    quizResult,
    timestamp: Date.now(),
  });
  
  logger.info('[Offline Sync] Quiz saved locally', { id });
  return id;
};

export const getPendingQuizzes = async () => {
  const db = await initDB();
  return db.getAll('pending_quizzes');
};

export const clearPendingQuiz = async (id: string): Promise<void> => {
  const db = await initDB();
  await db.delete('pending_quizzes', id);
};

export const getPendingQuizzesCount = async (): Promise<number> => {
  const db = await initDB();
  return db.count('pending_quizzes');
};

export const saveAICache = async (id: string, content: any): Promise<void> => {
  const db = await initDB();
  await db.put('ai_cache', {
    id,
    content,
    timestamp: Date.now()
  });
};

export const getAICache = async (id: string): Promise<any | null> => {
  const db = await initDB();
  const cached = await db.get('ai_cache', id);
  // Cache for 24 hours
  if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
    return cached.content;
  }
  return null;
};

// ── Quiz Content Pre-Cache (О1) ────────────────────────────────────────────
const QUIZ_CONTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const precacheQuizContent = async (cacheId: string, content: any): Promise<void> => {
  try {
    const db = await initDB();
    await db.put('quiz_content_cache', { id: cacheId, content, timestamp: Date.now() });
  } catch {
    // non-fatal: student still loads from Firestore when online
  }
};

export const getCachedQuizContent = async (cacheId: string): Promise<any | null> => {
  try {
    const db = await initDB();
    const cached = await db.get('quiz_content_cache', cacheId);
    if (cached && Date.now() - cached.timestamp < QUIZ_CONTENT_TTL_MS) {
      return cached.content;
    }
    return null;
  } catch {
    return null;
  }
};

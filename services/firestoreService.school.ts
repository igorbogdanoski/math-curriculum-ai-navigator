import { logger } from '../utils/logger';
import { doc, getDoc, collection, getDocs, query, where, orderBy, updateDoc, addDoc, getCountFromServer, getAggregateFromServer, average, limit, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { School } from '../types';

export interface SchoolTeacherStat {
  id: string;
  name: string;
  quizzesGiven: number;
  avgScore: number;
  materialsGenerated: number;
  /** ISO date string or null when unknown */
  lastActive: string | null;
  aiCreditsBalance: number;
}

export interface SchoolStatsData {
  totalTeachers: number;
  totalQuizzes: number;
  averageScore: number;
  teachers: SchoolTeacherStat[];
  gradeStats: { grade: string; avgPct: number; attempts: number }[];
  weeklyTrend: { avg: number; label: string }[];
}

export const schoolService = {

  createSchool: async (name: string, city: string, adminUid: string = '', opts?: { municipality?: string; address?: string }): Promise<School> => {
    try {
      const joinCode = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(36).padStart(2, '0')).join('').substring(0, 6).toUpperCase();
      const docRef = await addDoc(collection(db, 'schools'), {
        name,
        city,
        municipality: opts?.municipality ?? '',
        address: opts?.address ?? '',
        adminUid,
        adminUids: adminUid ? [adminUid] : [],
        teacherUids: [],
        joinCode,
        joinCodeGeneratedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      return { id: docRef.id, name, city, municipality: opts?.municipality, adminUid, adminUids: adminUid ? [adminUid] : [], teacherUids: [], joinCode };
    } catch (error) {
      logger.error('Error creating school:', error);
      throw error;
    }
  },

  /** Fetch a single school by ID */
  fetchSchool: async (schoolId: string): Promise<School | null> => {
    try {
      const snap = await getDoc(doc(db, 'schools', schoolId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as School;
    } catch {
      return null;
    }
  },

  /** Find a school by its 6-char join code (case-insensitive) */
  fetchSchoolByJoinCode: async (code: string): Promise<School | null> => {
    try {
      const q = query(collection(db, 'schools'), where('joinCode', '==', code.toUpperCase()), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as School;
    } catch {
      return null;
    }
  },

  /**
   * Teacher joins a school by code.
   * Adds teacherUid to school.teacherUids[] and updates the user profile.
   */
  joinSchoolByCode: async (code: string, teacherUid: string): Promise<School | null> => {
    if (!code?.trim() || !teacherUid?.trim()) return null;
    try {
      const school = await schoolService.fetchSchoolByJoinCode(code);
      if (!school) return null;
      await Promise.all([
        updateDoc(doc(db, 'schools', school.id), {
          teacherUids: arrayUnion(teacherUid),
        }),
        updateDoc(doc(db, 'users', teacherUid), {
          schoolId: school.id,
          schoolName: school.name,
        }),
      ]);
      return school;
    } catch (error) {
      logger.error('Error joining school:', error);
      throw error;
    }
  },

  /** Teacher leaves their current school */
  leaveSchool: async (schoolId: string, teacherUid: string): Promise<void> => {
    try {
      await Promise.all([
        updateDoc(doc(db, 'schools', schoolId), {
          teacherUids: arrayRemove(teacherUid),
        }),
        updateDoc(doc(db, 'users', teacherUid), {
          schoolId: null,
          schoolName: null,
        }),
      ]);
    } catch (error) {
      logger.error('Error leaving school:', error);
      throw error;
    }
  },

  /** School admin removes a teacher from the school */
  removeTeacherFromSchool: async (schoolId: string, teacherUid: string): Promise<void> => {
    try {
      await Promise.all([
        updateDoc(doc(db, 'schools', schoolId), {
          teacherUids: arrayRemove(teacherUid),
        }),
        updateDoc(doc(db, 'users', teacherUid), {
          schoolId: null,
          schoolName: null,
        }),
      ]);
    } catch (error) {
      logger.error('Error removing teacher:', error);
      throw error;
    }
  },

  /** Regenerate the join code for a school (invalidates the old one) */
  regenerateJoinCode: async (schoolId: string): Promise<string> => {
    const newCode = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(36).padStart(2, '0')).join('').substring(0, 6).toUpperCase();
    await updateDoc(doc(db, 'schools', schoolId), {
      joinCode: newCode,
      joinCodeGeneratedAt: serverTimestamp(),
    });
    return newCode;
  },

  fetchSchools: async (): Promise<any[]> => {
    try {
      const q = query(collection(db, 'schools'), orderBy('name'));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return [];
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error: any) {
      // permission-denied is expected when called from the login screen before auth resolves
      if (error?.code !== 'permission-denied') {
        logger.error('Error fetching schools:', error);
      }
      return [];
    }
  },

  fetchAllUsers: async (): Promise<{ uid: string; name: string; email?: string; role?: string; schoolId?: string }[]> => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map(d => ({ uid: d.id, ...d.data() as Record<string, unknown> })) as { uid: string; name: string; email?: string; role?: string; schoolId?: string }[];
    } catch (error) {
      logger.error('Error fetching all users:', error);
      return [];
    }
  },

  updateUserRole: async (uid: string, role: 'teacher' | 'school_admin' | 'admin', schoolId?: string): Promise<void> => {
    try {
      const patch: Record<string, string> = { role };
      if (schoolId !== undefined) patch.schoolId = schoolId;
      await updateDoc(doc(db, 'users', uid), patch);
    } catch (error) {
      logger.error('Error updating user role:', error);
      throw error;
    }
  },

  /** П-Д — Teacher Mentorship: volunteer mentor opt-in/out */
  toggleMentorStatus: async (uid: string, isMentor: boolean): Promise<void> => {
    await updateDoc(doc(db, 'users', uid), { isMentor });
  },

  updateUserSubscription: async (uid: string, updateData: { aiCreditsBalance?: number, isPremium?: boolean, hasUnlimitedCredits?: boolean, tier?: 'Free' | 'Pro' | 'Unlimited' }): Promise<void> => {
    try {
      await updateDoc(doc(db, 'users', uid), updateData);
    } catch (error) {
      logger.error('Error updating user subscription:', error);
      throw error;
    }
  },

  fetchNationalStats: async (): Promise<{
    totalSchools: number;
    totalTeachers: number;
    totalQuizzes: number;
    nationalAvg: number;
    gradeStats: { grade: string; avgPct: number; attempts: number }[];
    weakConcepts: { conceptId: string; avgPct: number; attempts: number }[];
  }> => {
    try {
      const [schoolsSnap, usersSnap, quizSnap] = await Promise.all([
        getDocs(collection(db, 'schools')),
        getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
        getDocs(query(collection(db, 'quiz_results'), orderBy('playedAt', 'desc'), limit(2000))),
      ]);

      const totalSchools = schoolsSnap.size;
      const totalTeachers = usersSnap.size;
      const totalQuizzes = quizSnap.size;

      const gradeMap: Record<string, { sum: number; count: number }> = {};
      const conceptMap: Record<string, { sum: number; count: number }> = {};
      let globalSum = 0;

      quizSnap.forEach(d => {
        const r = d.data();
        const pct: number = r.percentage ?? 0;
        globalSum += pct;

        const grade = r.gradeLevel != null ? String(r.gradeLevel) : null;
        if (grade) {
          if (!gradeMap[grade]) gradeMap[grade] = { sum: 0, count: 0 };
          gradeMap[grade].sum += pct;
          gradeMap[grade].count++;
        }

        const cid: string | undefined = r.conceptId;
        if (cid) {
          if (!conceptMap[cid]) conceptMap[cid] = { sum: 0, count: 0 };
          conceptMap[cid].sum += pct;
          conceptMap[cid].count++;
        }
      });

      const gradeStats = Object.entries(gradeMap)
        .map(([grade, v]) => ({ grade: `${grade}. одд.`, avgPct: Math.round(v.sum / v.count), attempts: v.count }))
        .sort((a, b) => parseInt(a.grade) - parseInt(b.grade));

      const weakConcepts = Object.entries(conceptMap)
        .filter(([, v]) => v.count >= 3)
        .map(([conceptId, v]) => ({ conceptId, avgPct: Math.round(v.sum / v.count), attempts: v.count }))
        .sort((a, b) => a.avgPct - b.avgPct)
        .slice(0, 10);

      return {
        totalSchools,
        totalTeachers,
        totalQuizzes,
        nationalAvg: totalQuizzes > 0 ? Math.round(globalSum / totalQuizzes) : 0,
        gradeStats,
        weakConcepts,
      };
    } catch (error) {
      logger.error('Error fetching national stats:', error);
      return { totalSchools: 0, totalTeachers: 0, totalQuizzes: 0, nationalAvg: 0, gradeStats: [], weakConcepts: [] };
    }
  },

  fetchSchoolStats: async (schoolId: string): Promise<SchoolStatsData | null> => {
    try {
      const usersRef = collection(db, 'users');
      const qTeachers = query(usersRef, where('schoolId', '==', schoolId));
      const teachersSnap = await getDocs(qTeachers);

      const teachersData: SchoolTeacherStat[] = [];
      let totalSchoolQuizzes = 0;
      let globalScoreSum = 0;
      let teachersWithQuizzes = 0;

      for (const tDoc of teachersSnap.docs) {
        const tData = tDoc.data();
        if (tData.role !== 'teacher') continue;

        const quizRef = collection(db, 'quiz_results');
        const qQuizzes = query(quizRef, where('teacherUid', '==', tDoc.id));

        getAggregateFromServer(qQuizzes, { total: average('percentage') }).catch(() => {/* non-fatal */});

        const countSnap = await getCountFromServer(qQuizzes);
        const quizzesGiven = countSnap.data().count;

        let avgScore = 0;
        if (quizzesGiven > 0) {
          const quizzes = await getDocs(query(quizRef, where('teacherUid', '==', tDoc.id), limit(500)));
          let sum = 0;
          quizzes.forEach(q => sum += (q.data().percentage || 0));
          avgScore = sum / quizzes.size;
          globalScoreSum += avgScore;
          teachersWithQuizzes++;
        }

        totalSchoolQuizzes += quizzesGiven;
        teachersData.push({
          id: tDoc.id,
          name: tData.name as string || 'Непознат наставник',
          quizzesGiven,
          avgScore,
          materialsGenerated: 0,
          lastActive: tData.lastActive ? new Date(tData.lastActive as string).toISOString() : null,
          aiCreditsBalance: (tData.aiCreditsBalance as number) ?? 0,
        });
      }

      // Count generated materials per teacher
      const teacherUids = teachersData.map(t => t.id);
      if (teacherUids.length > 0) {
        const BATCH = 30;
        const materialCounts: Record<string, number> = {};
        for (let i = 0; i < teacherUids.length; i += BATCH) {
          const batch = teacherUids.slice(i, i + BATCH);
          const matSnap = await getDocs(query(collection(db, 'cached_ai_materials'), where('teacherUid', 'in', batch)));
          matSnap.forEach(d => {
            const uid = d.data().teacherUid as string;
            materialCounts[uid] = (materialCounts[uid] ?? 0) + 1;
          });
        }
        teachersData.forEach(t => { t.materialsGenerated = materialCounts[t.id] ?? 0; });
      }

      // School-wide grade comparison + weekly trend
      const gradeMap: Record<string, { sum: number; count: number }> = {};
      const weekMap: Record<string, { sum: number; count: number; label: string }> = {};
      if (teacherUids.length > 0) {
        const BATCH = 30;
        for (let i = 0; i < teacherUids.length; i += BATCH) {
          const batch = teacherUids.slice(i, i + BATCH);
          const qrSnap = await getDocs(query(collection(db, 'quiz_results'), where('teacherUid', 'in', batch), limit(500)));
          qrSnap.forEach(d => {
            const r = d.data();
            const grade = r.gradeLevel != null ? String(r.gradeLevel) : null;
            if (grade) {
              if (!gradeMap[grade]) gradeMap[grade] = { sum: 0, count: 0 };
              gradeMap[grade].sum += r.percentage ?? 0;
              gradeMap[grade].count++;
            }
            const ts = r.playedAt?.toDate ? r.playedAt.toDate() : (r.playedAt ? new Date(r.playedAt) : null);
            if (ts) {
              const mon = new Date(ts); mon.setDate(ts.getDate() - ts.getDay() + 1);
              const wk = mon.toISOString().slice(0, 10);
              const lbl = mon.toLocaleDateString('mk-MK', { day: '2-digit', month: 'short' });
              if (!weekMap[wk]) weekMap[wk] = { sum: 0, count: 0, label: lbl };
              weekMap[wk].sum += r.percentage ?? 0;
              weekMap[wk].count++;
            }
          });
        }
      }

      const gradeStats = Object.entries(gradeMap)
        .map(([grade, v]) => ({ grade: `${grade}. одд.`, avgPct: Math.round(v.sum / v.count), attempts: v.count }))
        .sort((a, b) => parseInt(a.grade) - parseInt(b.grade));

      const weeklyTrend = Object.entries(weekMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([, v]) => ({ avg: Math.round(v.sum / v.count), label: v.label }));

      return {
        totalTeachers: teachersData.length,
        totalQuizzes: totalSchoolQuizzes,
        averageScore: teachersWithQuizzes > 0 ? globalScoreSum / teachersWithQuizzes : 0,
        teachers: teachersData,
        gradeStats,
        weeklyTrend,
      };
    } catch (error) {
      logger.error('Error fetching school stats:', error);
      return null;
    }
  },
};

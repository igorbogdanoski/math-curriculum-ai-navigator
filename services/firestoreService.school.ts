import { doc, collection, getDocs, query, where, orderBy, updateDoc, addDoc, getCountFromServer, getAggregateFromServer, average, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const schoolService = {

  createSchool: async (name: string, city: string, adminUid: string = ''): Promise<{id: string, name: string, city: string}> => {
    try {
      const docRef = await addDoc(collection(db, 'schools'), {
        name, city, adminUid, teacherUids: [], createdAt: new Date()
      });
      return { id: docRef.id, name, city };
    } catch (error) {
      console.error('Error creating school:', error);
      throw error;
    }
  },

  fetchSchools: async (): Promise<any[]> => {
    try {
      const q = query(collection(db, 'schools'), orderBy('name'));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return [];
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error('Error fetching schools:', error);
      return [];
    }
  },

  fetchAllUsers: async (): Promise<{ uid: string; name: string; email?: string; role?: string; schoolId?: string }[]> => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }));
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    }
  },

  updateUserRole: async (uid: string, role: 'teacher' | 'school_admin' | 'admin', schoolId?: string): Promise<void> => {
    try {
      const patch: Record<string, string> = { role };
      if (schoolId !== undefined) patch.schoolId = schoolId;
      await updateDoc(doc(db, 'users', uid), patch);
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },

  fetchSchoolStats: async (schoolId: string): Promise<any> => {
    try {
      const usersRef = collection(db, 'users');
      const qTeachers = query(usersRef, where('schoolId', '==', schoolId));
      const teachersSnap = await getDocs(qTeachers);

      const teachersData: any[] = [];
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
          name: tData.name || 'Непознат наставник',
          quizzesGiven,
          avgScore,
          lastActive: tData.lastActive ? new Date(tData.lastActive).toISOString() : 'Непознато',
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
      console.error('Error fetching school stats:', error);
      return null;
    }
  },
};

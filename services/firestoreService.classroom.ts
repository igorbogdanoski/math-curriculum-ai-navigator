import { doc, getDoc, collection, getDocs, query, limit, orderBy, updateDoc, increment, where, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp, startAfter, arrayUnion, documentId, getCountFromServer, getAggregateFromServer, average, type DocumentSnapshot, type Timestamp } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { type CurriculumModule } from '../data/curriculum';
import { type DifferentiationLevel, type SavedQuestion } from '../types';
import { type StudentGroup, type SchoolClass, type ClassMembership, type Announcement } from './firestoreService.types';
import { parseFirestoreDoc, SchoolClassSchema, ClassMembershipSchema } from '../schemas/firestoreSchemas';
import { calcXP, calcStreak, computeNewAchievements } from '../utils/gamification';
import { getE2EMockClasses } from './e2eTesting';

export const fetchStudentGroups = async (teacherUid?: string): Promise<StudentGroup[]> => {
    try {
      const q = teacherUid
        ? query(collection(db, 'student_groups'), where('teacherUid', '==', teacherUid))
        : collection(db, 'student_groups');
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentGroup));
    } catch (error) {
      console.error('Error fetching student groups:', error);
      return [];
    }
  };

export const createStudentGroup = async (name: string, color: string, teacherUid?: string): Promise<string> => {
    const ref = await addDoc(collection(db, 'student_groups'), {
      name,
      color,
      studentNames: [],
      ...(teacherUid ? { teacherUid } : {}),
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

export const updateGroupStudents = async (groupId: string, studentNames: string[]): Promise<void> => {
    await updateDoc(doc(db, 'student_groups', groupId), { studentNames });
  };

export const deleteStudentGroup = async (groupId: string): Promise<void> => {
    await deleteDoc(doc(db, 'student_groups', groupId));
  };

export const fetchClasses = async (teacherUid: string): Promise<SchoolClass[]> => {
    const e2eClasses = getE2EMockClasses(teacherUid);
    if (e2eClasses) return e2eClasses;

    try {
      const q = query(collection(db, 'classes'), where('teacherUid', '==', teacherUid), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => parseFirestoreDoc(SchoolClassSchema, { id: d.id, ...d.data() }, `classes/${d.id}`) as SchoolClass);
    } catch (error) {
      console.error('Error fetching classes:', error);
      return [];
    }
  };

export const createClass = async (cls: Omit<SchoolClass, 'id' | 'createdAt'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'classes'), {
      ...cls,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

export const updateClass = async (classId: string, updates: Partial<Pick<SchoolClass, 'name' | 'gradeLevel' | 'studentNames'>>): Promise<void> => {
    await updateDoc(doc(db, 'classes', classId), updates);
  };

export const deleteClass = async (classId: string): Promise<void> => {
    await deleteDoc(doc(db, 'classes', classId));
  };

/** П-Г: Fetch a single class by ID (used by StudentPlayView to detect IEP mode) */
export const fetchClassById = async (classId: string): Promise<SchoolClass | null> => {
    const snap = await getDoc(doc(db, 'classes', classId));
    if (!snap.exists()) return null;
    return parseFirestoreDoc(SchoolClassSchema, { id: snap.id, ...snap.data() }, `classes/${classId}`) as SchoolClass;
};

/** П-Г: Toggle IEP flag for a student within a class */
export const toggleIEPStudent = async (classId: string, studentName: string, iepStudents: string[]): Promise<void> => {
    const isIEP = iepStudents.includes(studentName);
    const updated = isIEP
        ? iepStudents.filter(n => n !== studentName)
        : [...iepStudents, studentName];
    await updateDoc(doc(db, 'classes', classId), { iepStudents: updated });
};

// ── И2: Class Join Code ─────────────────────────────────────────────────────

/** Generate and persist a cryptographically-secure 6-char join code for a class */
export const generateClassJoinCode = async (classId: string): Promise<string | null> => {
  try {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(36).padStart(2, '0')).join('').substring(0, 6).toUpperCase();
    await updateDoc(doc(db, 'classes', classId), { joinCode: code, joinCodeGeneratedAt: serverTimestamp() });
    return code;
  } catch (error) {
    console.error('Failed to generate class join code:', error);
    return null;
  }
};

/** Find a class by its 6-char join code (case-insensitive) */
export const fetchClassByJoinCode = async (code: string): Promise<SchoolClass | null> => {
  try {
    const q = query(collection(db, 'classes'), where('joinCode', '==', code.trim().toUpperCase()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return parseFirestoreDoc(SchoolClassSchema, { id: snap.docs[0].id, ...snap.docs[0].data() }, `classes/${snap.docs[0].id}`) as SchoolClass;
  } catch { return null; }
};

/** Student joins a class by code — writes class_memberships/{deviceId} */
export const joinClassByCode = async (code: string, deviceId: string, studentName: string): Promise<SchoolClass | null> => {
  if (!code?.trim() || !deviceId?.trim()) return null;
  const cls = await fetchClassByJoinCode(code);
  if (!cls) return null;
  await setDoc(doc(db, 'class_memberships', deviceId), {
    deviceId,
    classId: cls.id,
    className: cls.name,
    gradeLevel: cls.gradeLevel,
    teacherUid: cls.teacherUid,
    studentName: studentName || null,
    joinedAt: serverTimestamp(),
  }, { merge: true });
  return cls;
};

/** Fetch the class membership for a device (returns null if not joined any class) */
export const fetchClassMembership = async (deviceId: string): Promise<ClassMembership | null> => {
  try {
    const snap = await getDoc(doc(db, 'class_memberships', deviceId));
    if (!snap.exists()) return null;
    return parseFirestoreDoc(ClassMembershipSchema, snap.data(), `class_memberships/${deviceId}`) as ClassMembership;
  } catch { return null; }
};

/** Fetch per-student quiz stats for a class (lazy analytics) */
export const fetchClassStats = async (
  teacherUid: string,
  studentNames: string[]
): Promise<{ name: string; avgPct: number; count: number }[]> => {
  if (!teacherUid || studentNames.length === 0) return [];
  try {
    const snap = await getDocs(query(
      collection(db, 'quiz_results'),
      where('teacherUid', '==', teacherUid),
      limit(500)
    ));
    const nameSet = new Set(studentNames);
    const map: Record<string, { sum: number; count: number }> = {};
    snap.forEach(d => {
      const r = d.data();
      const n: string | undefined = r.studentName;
      if (n && nameSet.has(n)) {
        if (!map[n]) map[n] = { sum: 0, count: 0 };
        map[n].sum += r.percentage ?? 0;
        map[n].count++;
      }
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, avgPct: Math.round(v.sum / v.count), count: v.count }))
      .sort((a, b) => b.avgPct - a.avgPct);
  } catch { return []; }
};

export const addAnnouncement = async (teacherUid: string, message: string, gradeLevel?: number): Promise<void> => {
    await addDoc(collection(db, 'announcements'), {
      teacherUid,
      message: message.trim(),
      gradeLevel: gradeLevel ?? null,
      createdAt: serverTimestamp(),
    });
  };

export const fetchAnnouncements = async (teacherUid: string, maxCount = 5): Promise<Announcement[]> => {
    try {
      const q = query(
        collection(db, 'announcements'),
        where('teacherUid', '==', teacherUid),
        orderBy('createdAt', 'desc'),
        limit(maxCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
    } catch {
      return [];
    }
  };

export const deleteAnnouncement = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'announcements', id));
  };

export const saveStudentIdentity = async (deviceId: string, name: string, anonymousUid: string): Promise<void> => {
    await setDoc(doc(db, 'student_identity', deviceId), {
      deviceId,
      name,
      anonymousUid,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

export const fetchStudentIdentityByDevice = async (deviceId: string): Promise<{ name: string; anonymousUid: string } | null> => {
    const snap = await getDoc(doc(db, 'student_identity', deviceId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return { name: data.name, anonymousUid: data.anonymousUid };
  };

export interface MaturaAssignment {
  id?: string;
  teacherUid: string;
  classId: string;
  title: string;
  questionIds: string[];
  createdAt?: unknown;
}

export const createAssignment = async (
  teacherUid: string,
  classId: string,
  title: string,
  questionIds: string[],
): Promise<string> => {
  const ref = await addDoc(collection(db, 'matura_assignments'), {
    teacherUid,
    classId,
    title,
    questionIds,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};


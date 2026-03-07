import { doc, getDoc, collection, getDocs, query, limit, orderBy, updateDoc, increment, where, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp, startAfter, arrayUnion, documentId, getCountFromServer, getAggregateFromServer, average, type DocumentSnapshot, type Timestamp } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { type CurriculumModule } from '../data/curriculum';
import { type DifferentiationLevel, type SavedQuestion } from '../types';
import { calcXP, calcStreak, computeNewAchievements } from '../utils/gamification';

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
    try {
      const q = query(collection(db, 'classes'), where('teacherUid', '==', teacherUid), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolClass));
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


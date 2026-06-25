// ─── User domain types ────────────────────────────────────────────────────────
// User profiles, school, student accounts, chat. These types represent
// the "who" in the system — teachers, students, schools.

import type { SecondaryTrack } from './curriculum';

export interface School {
  id: string;
  name: string;
  city: string;
  municipality?: string;
  address?: string;
  teacherUids: string[];
  /** Legacy single admin; new docs use adminUids[] */
  adminUid: string;
  adminUids?: string[];
  /** 6-char uppercase code teachers use to join */
  joinCode?: string;
  joinCodeGeneratedAt?: any;
  createdAt?: any;
}

export interface StudentProfile {
  id: string;
  name: string;
  description: string;
}

/**
 * Persistent студентски акаунт (Google Sign-In за ученици).
 * Зачуван во `student_accounts/{googleUid}` во Firestore.
 */
export interface StudentAccount {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
  grade?: number;
  linkedDeviceIds: string[];
  createdAt: any;
  updatedAt?: any;
}

export interface TeachingProfile {
  name: string;
  photoURL?: string;
  role?: 'teacher' | 'school_admin' | 'admin';
  schoolId?: string;
  schoolName?: string;
  municipality?: string;

  aiCreditsBalance?: number;
  isPremium?: boolean;
  hasUnlimitedCredits?: boolean;
  tier?: 'Free' | 'Pro' | 'School' | 'Unlimited';

  schoolLogoUrl?: string;
  isMentor?: boolean;

  /** Н4 — if set, teacher works in secondary education */
  secondaryTrack?: SecondaryTrack;

  style: 'Constructivist' | 'Direct Instruction' | 'Inquiry-Based' | 'Project-Based';
  experienceLevel: 'Beginner' | 'Intermediate' | 'Expert';
  levelDescription?: string;
  studentProfiles?: StudentProfile[];
  favoriteConceptIds?: string[];
  favoriteLessonPlanIds?: string[];
  toursSeen?: Record<string, boolean>;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  levelDescription?: string;
  attachmentUrl?: string;
}

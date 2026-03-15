import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where, orderBy,
  limit, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface ChatSession {
  id: string;
  teacherUid: string;
  title: string;           // Auto-generated from first user message
  libraryMode: boolean;
  messages: StoredMessage[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StoredMessage {
  role: 'user' | 'model';
  text: string;
  attachmentUrl?: string;
  sources?: { id: string; title: string; type: string; score: number }[];
}

/** Save a new chat session and return its Firestore ID. */
export const createChatSession = async (
  teacherUid: string,
  messages: StoredMessage[],
  libraryMode: boolean
): Promise<string> => {
  const firstUser = messages.find(m => m.role === 'user');
  const title = firstUser
    ? firstUser.text.substring(0, 60) + (firstUser.text.length > 60 ? '…' : '')
    : 'Нов разговор';

  const ref = await addDoc(collection(db, 'chat_sessions'), {
    teacherUid,
    title,
    libraryMode,
    messages,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

/** Overwrite messages in an existing session. */
export const updateChatSession = async (
  sessionId: string,
  messages: StoredMessage[]
): Promise<void> => {
  await updateDoc(doc(db, 'chat_sessions', sessionId), {
    messages,
    updatedAt: serverTimestamp(),
  });
};

/** Fetch the 20 most recent chat sessions for a teacher. */
export const fetchChatSessions = async (
  teacherUid: string
): Promise<ChatSession[]> => {
  try {
    const q = query(
      collection(db, 'chat_sessions'),
      where('teacherUid', '==', teacherUid),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatSession));
  } catch {
    return [];
  }
};

/** Delete a single chat session. */
export const deleteChatSession = async (sessionId: string): Promise<void> => {
  await deleteDoc(doc(db, 'chat_sessions', sessionId));
};

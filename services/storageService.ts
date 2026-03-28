/**
 * Firebase Storage helpers.
 * Currently used for teacher-uploaded question images.
 */
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';

/**
 * Uploads a teacher-supplied image file for a quiz question.
 * Returns the public download URL.
 *
 * Path: question-images/{teacherUid}/{timestamp}-{randomSuffix}.{ext}
 */
export const uploadQuestionImage = async (file: File, teacherUid: string): Promise<string> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `question-images/${teacherUid}/${name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

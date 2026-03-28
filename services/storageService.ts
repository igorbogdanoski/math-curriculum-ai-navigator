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
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB — mirrors storage.rules limit
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const uploadQuestionImage = async (file: File, teacherUid: string): Promise<string> => {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Сликата е преголема (макс. 8 MB). Вашата слика е ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`Неподдржан формат на слика. Дозволени: JPEG, PNG, WebP, GIF.`);
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `question-images/${teacherUid}/${name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

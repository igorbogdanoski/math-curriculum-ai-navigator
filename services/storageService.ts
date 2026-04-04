/**
 * Firebase Storage helpers.
 * Currently used for teacher-uploaded question images.
 */
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import { AppError, ErrorCode } from '../utils/errors';

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
    throw new AppError(
      `Image size exceeds limit: ${(file.size / 1024 / 1024).toFixed(1)} MB`,
      ErrorCode.VALIDATION_FAILED,
      `Сликата е преголема (макс. 8 MB). Вашата слика е ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      false,
    );
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new AppError(
      `Unsupported image format: ${file.type || 'unknown'}`,
      ErrorCode.VALIDATION_FAILED,
      'Неподдржан формат на слика. Дозволени: JPEG, PNG, WebP, GIF.',
      false,
    );
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `question-images/${teacherUid}/${name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

/**
 * Uploads a data-URL (PNG) from AlgebraTiles canvas to Firebase Storage.
 * Returns the public download URL.
 * Path: forum-images/{teacherUid}/{timestamp}.png
 */
export const uploadForumImage = async (dataUrl: string, teacherUid: string): Promise<string> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const path = `forum-images/${teacherUid}/${Date.now()}.png`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/png' });
  return getDownloadURL(storageRef);
};

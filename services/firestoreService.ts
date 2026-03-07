import { schoolService } from './firestoreService.school';
import { quizService } from './firestoreService.quiz';
import * as classroomMethods from './firestoreService.classroom';
import * as materialsMethods from './firestoreService.materials';
import * as liveMethods from './firestoreService.live';

export * from './firestoreService.types';
export * from './firestoreService.school';
export * from './firestoreService.quiz';
export * from './firestoreService.classroom';
export * from './firestoreService.materials';
export * from './firestoreService.live';

export const firestoreService = {
  ...schoolService,
  ...quizService,
  ...classroomMethods,
  ...materialsMethods,
  ...liveMethods
};

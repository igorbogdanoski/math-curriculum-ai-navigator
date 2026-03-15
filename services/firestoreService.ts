import { schoolService } from './firestoreService.school';
import { quizService } from './firestoreService.quiz';
import * as classroomMethods from './firestoreService.classroom';
import * as materialsMethods from './firestoreService.materials';
import * as liveMethods from './firestoreService.live';
import { spacedRepService } from './firestoreService.spacedRep';
import * as chatMethods from './firestoreService.chat';
import { studentAccountService } from './firestoreService.studentAccount';

export * from './firestoreService.types';
export * from './firestoreService.school';
export * from './firestoreService.quiz';
export * from './firestoreService.classroom';
export * from './firestoreService.materials';
export * from './firestoreService.live';
export * from './firestoreService.spacedRep';
export * from './firestoreService.chat';
export * from './firestoreService.studentAccount';

export const firestoreService = {
  ...schoolService,
  ...quizService,
  ...classroomMethods,
  ...materialsMethods,
  ...liveMethods,
  ...spacedRepService,
  ...chatMethods,
  ...studentAccountService,
};

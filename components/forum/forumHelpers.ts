import type { ForumThread, ForumReply, ReactionField } from '../../services/firestoreService.forum';
import type { Concept } from '../../types';

export type EnrichedConcept = Concept & { gradeLevel: number; topicId: string };

export function reactionArr(obj: ForumThread | ForumReply, field: ReactionField): string[] {
  return (obj[field as keyof (ForumThread | ForumReply)] as string[] | undefined) ?? [];
}

export function formatDate(ts: any): string {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

export function timeAgo(ts: any): string {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'току што';
    if (mins < 60) return `пред ${mins} мин`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `пред ${hrs} ч`;
    const days = Math.floor(hrs / 24);
    if (days < 7)  return `пред ${days} д`;
    const weeks = Math.floor(days / 7);
    return `пред ${weeks} нед`;
  } catch { return ''; }
}

export function isHot(thread: ForumThread): boolean {
  if (!thread.createdAt) return false;
  const ageHours = (Date.now() - thread.createdAt.toDate().getTime()) / 3_600_000;
  return ageHours < 72 && (thread.upvotedBy.length + thread.replyCount) >= 3;
}

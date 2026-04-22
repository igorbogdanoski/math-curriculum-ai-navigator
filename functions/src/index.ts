import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();

// ── О1: Push notification when teacher assigns a quiz ─────────────────────
/**
 * Triggers on new assignment document.
 * Sends FCM push to:
 *  1. All teachers/admins in the same school (collaboration awareness)
 *  2. School admins (visibility into class activity)
 *
 * Students are currently anonymous (no FCM tokens); this function is
 * forward-compatible — when student Google auth (С1) FCM tokens are
 * added to user_tokens, add their uids to the `recipients` set below.
 */
export const onAssignmentCreated = functions.firestore
  .document('assignments/{assignmentId}')
  .onCreate(async (snap) => {
    try {
      const assignment = snap.data();
      if (!assignment) return null;

      const teacherUid: string = assignment.teacherUid ?? '';
      const title: string = assignment.title ?? 'Нова задача';
      const cacheId: string = assignment.cacheId ?? '';
      const className: string = assignment.classId ?? '';

      // 1. Get assigning teacher's schoolId
      const teacherSnap = await admin.firestore().collection('users').doc(teacherUid).get();
      const schoolId: string = teacherSnap.data()?.schoolId ?? '';

      // Collect recipient UIDs (exclude the assigning teacher)
      const recipientUids = new Set<string>();

      if (schoolId) {
        const schoolSnap = await admin.firestore().collection('schools').doc(schoolId).get();
        const schoolData = schoolSnap.data();
        // Add school teachers
        for (const uid of (schoolData?.teacherUids ?? [])) {
          if (uid !== teacherUid) recipientUids.add(uid);
        }
        // Add school admins
        for (const uid of (schoolData?.adminUids ?? [])) {
          if (uid !== teacherUid) recipientUids.add(uid);
        }
      }

      if (recipientUids.size === 0) return null;

      // 2. Fetch FCM tokens for recipients
      const tokenSet = new Set<string>();
      await Promise.all(
        Array.from(recipientUids).map(async (uid) => {
          try {
            const doc = await admin.firestore().collection('user_tokens').doc(`${uid}_web`).get();
            const t = doc.data()?.token;
            if (typeof t === 'string' && t.length > 0) tokenSet.add(t);
          } catch { /* token missing — skip */ }
        }),
      );
      const tokens = Array.from(tokenSet);

      if (tokens.length === 0) return null;

      // 3. Send FCM multicast
      const teacherName: string = teacherSnap.data()?.name ?? 'Наставник';
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: `📋 Нова задача — ${teacherName}`,
          body: title,
        },
        webpush: {
          notification: {
            icon: '/icon-192.svg',
            badge: '/icon-192.svg',
          },
          fcmOptions: {
            link: cacheId ? `/#/play/${cacheId}` : '/#/analytics',
          },
          headers: { TTL: '86400' },
        },
        data: {
          type: 'new_assignment',
          assignmentId: snap.id,
          cacheId,
          classId: className,
        },
      });

      return null;
    } catch (err) {
      console.error('[onAssignmentCreated]', err);
      return null;
    }
  });

/**
 * Cloud Function to aggregate student progress.
 * Triggered whenever a student completes a concept (document written in \student_progress\ collection).
 * This offloads the heavy aggregation calculation from the client, saving Firestore reads limit.
 */
export const aggregateStudentProgress = functions.firestore
  .document('student_progress/{progressId}')
  .onWrite(async (change, _context) => {
    const data = change.after.exists ? change.after.data() : null;
    
    if (!data) return null; // Document was deleted

    const userId = data.studentId;
    const gradeLevel = data.gradeLevel;
    
    if (!userId || !gradeLevel) return null;

    const db = admin.firestore();

    // Re-calculate the overall completion
    // E.g., getting all progress for the student
    const progressRef = db.collection('student_progress').where('studentId', '==', userId).where('gradeLevel', '==', gradeLevel);
    const snapshot = await progressRef.get();

    let totalScore = 0;
    let totalCompleted = 0;

    snapshot.forEach(doc => {
      const p = doc.data();
      if (p.completed) {
        totalCompleted += 1;
        totalScore += (p.score || 0);
      }
    });

    const averageScore = totalCompleted > 0 ? (totalScore / totalCompleted) : 0;

    // Save the aggregated data to a single document that the teacher/dashboard can read
    // This turns 100s of client reads into just 1 document read!
    const aggRef = db.collection('student_aggregations').doc(`${userId}_${gradeLevel}`);

    await aggRef.set({
      studentId: userId,
      gradeLevel: gradeLevel,
      totalCompletedConcepts: totalCompleted,
      averageScore: averageScore,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return null;
  });

/**
 * Cloud Function to securely deduct AI credits from a user's balance.
 * Protects against client-side tampering of the aiCreditsBalance field.
 */
export const deductCredits = functions.https.onCall(async (data, context) => {
  // Ensure the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in to deduct credits.');
  }

  const uid = context.auth.uid;
  const amountToDeduct = typeof data.amount === 'number' ? data.amount : 1;

  if (amountToDeduct <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Amount must be a positive number.');
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  try {
    return await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
      }

      const userData = userDoc.data();
      const currentBalance = userData?.aiCreditsBalance || 0;
      
      // Allow bypass if they are premium/admin/unlimited (just in case they call it anyway)
      if (userData?.role === 'admin' || userData?.isPremium || userData?.hasUnlimitedCredits) {
         return { success: true, newBalance: currentBalance, bypassed: true };
      }

      if (currentBalance < amountToDeduct) {
         throw new functions.https.HttpsError('resource-exhausted', 'Insufficient AI credits.');
      }

      const newBalance = Math.max(0, currentBalance - amountToDeduct);
      
      // Perform the update
      transaction.update(userRef, { aiCreditsBalance: newBalance });

      return { success: true, newBalance };
    });
  } catch (error: any) {
    console.error('Error deducting credits:', error);
    throw new functions.https.HttpsError('internal', 'Transaction failed: ' + error.message);
  }
});

// ── S19-P2: Forum reply push notifications ─────────────────────────────────
interface ForumReplyDeliveryInput {
  threadId: string;
  replyId: string;
  actorUid: string;
  actorName: string;
}

interface ForumReplyDeliveryOptions {
  dryRun?: boolean;
  source: 'trigger' | 'manual_replay';
}

interface ForumReplyDeliveryResult {
  threadId: string;
  replyId: string;
  actorUid: string;
  recipientCount: number;
  uniqueTokenCount: number;
  missingTokenUids: string[];
  dryRun: boolean;
  successCount: number;
  failureCount: number;
  prunedTokenUids?: string[];
}

const getUserRole = async (uid: string): Promise<string> => {
  const snap = await admin.firestore().collection('users').doc(uid).get();
  const role = snap.data()?.role;
  return typeof role === 'string' ? role : '';
};

const deliverForumReplyNotification = async (
  input: ForumReplyDeliveryInput,
  options: ForumReplyDeliveryOptions,
): Promise<ForumReplyDeliveryResult> => {
  const db = admin.firestore();

  const threadSnap = await db.collection('forum_threads').doc(input.threadId).get();
  if (!threadSnap.exists) {
    throw new Error(`Thread not found: ${input.threadId}`);
  }
  const thread = threadSnap.data() ?? {};
  const threadAuthorUid: string = thread.authorUid ?? '';
  const threadTitle: string = thread.title ?? 'Форум нишка';

  const recipientUids = new Set<string>();
  if (threadAuthorUid && threadAuthorUid !== input.actorUid) {
    recipientUids.add(threadAuthorUid);
  }

  const participantsSnap = await db
    .collection('forum_replies')
    .where('threadId', '==', input.threadId)
    .limit(50)
    .get();

  participantsSnap.docs.forEach((docSnap) => {
    const participantUid = (docSnap.data()?.authorUid ?? '') as string;
    if (!participantUid || participantUid === input.actorUid) return;
    recipientUids.add(participantUid);
  });

  if (recipientUids.size === 0) {
    console.info('[onForumReplyCreated] no recipients', {
      threadId: input.threadId,
      replyId: input.replyId,
      actorUid: input.actorUid,
      source: options.source,
      dryRun: Boolean(options.dryRun),
    });
    return {
      threadId: input.threadId,
      replyId: input.replyId,
      actorUid: input.actorUid,
      recipientCount: 0,
      uniqueTokenCount: 0,
      missingTokenUids: [],
      dryRun: Boolean(options.dryRun),
      successCount: 0,
      failureCount: 0,
    };
  }

  const tokenToUid = new Map<string, string>();
  const missingTokenUids: string[] = [];
  await Promise.all(
    Array.from(recipientUids).map(async (uid) => {
      try {
        const tokenSnap = await db.collection('user_tokens').doc(`${uid}_web`).get();
        const token = tokenSnap.data()?.token;
        if (typeof token === 'string' && token.length > 0) {
          if (!tokenToUid.has(token)) tokenToUid.set(token, uid);
        } else {
          missingTokenUids.push(uid);
        }
      } catch {
        missingTokenUids.push(uid);
      }
    }),
  );

  const tokens = Array.from(tokenToUid.keys());
  if (tokens.length === 0) {
    console.info('[onForumReplyCreated] no tokens', {
      threadId: input.threadId,
      replyId: input.replyId,
      actorUid: input.actorUid,
      recipientCount: recipientUids.size,
      missingTokenUids,
      source: options.source,
      dryRun: Boolean(options.dryRun),
    });
    return {
      threadId: input.threadId,
      replyId: input.replyId,
      actorUid: input.actorUid,
      recipientCount: recipientUids.size,
      uniqueTokenCount: 0,
      missingTokenUids,
      dryRun: Boolean(options.dryRun),
      successCount: 0,
      failureCount: 0,
    };
  }

  console.info('[onForumReplyCreated] delivery attempt', {
    threadId: input.threadId,
    replyId: input.replyId,
    actorUid: input.actorUid,
    recipientCount: recipientUids.size,
    uniqueTokenCount: tokens.length,
    missingTokenUids,
    source: options.source,
    dryRun: Boolean(options.dryRun),
  });

  if (options.dryRun) {
    return {
      threadId: input.threadId,
      replyId: input.replyId,
      actorUid: input.actorUid,
      recipientCount: recipientUids.size,
      uniqueTokenCount: tokens.length,
      missingTokenUids,
      dryRun: true,
      successCount: 0,
      failureCount: 0,
    };
  }

  const result = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: `💬 Нова порака — ${input.actorName}`,
      body: `Во нишката: ${threadTitle}`,
    },
    webpush: {
      notification: {
        icon: '/icon-192.svg',
        badge: '/icon-192.svg',
      },
      fcmOptions: {
        link: `/#/forum?thread=${encodeURIComponent(input.threadId)}`,
      },
      headers: { TTL: '21600' },
    },
    data: {
      type: 'forum_reply',
      threadId: input.threadId,
      replyId: input.replyId,
      actorUid: input.actorUid,
    },
  });

  // S19-P2 hardening: prune stale tokens (unregistered/invalid) so the next
  // replay does not waste multicast slots on dead browser registrations.
  const prunedTokenUids: string[] = [];
  if (result.failureCount > 0) {
    const stalePruneOps: Promise<unknown>[] = [];
    result.responses.forEach((resp, idx) => {
      if (resp.success) return;
      const code = resp.error?.code ?? '';
      const isStale =
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument';
      if (!isStale) return;
      const token = tokens[idx];
      const uid = token ? tokenToUid.get(token) : undefined;
      if (!uid) return;
      prunedTokenUids.push(uid);
      stalePruneOps.push(
        db.collection('user_tokens').doc(`${uid}_web`).delete().catch(() => undefined),
      );
    });
    if (stalePruneOps.length > 0) {
      await Promise.all(stalePruneOps);
    }
  }

  console.info('[onForumReplyCreated] delivery result', {
    threadId: input.threadId,
    replyId: input.replyId,
    successCount: result.successCount,
    failureCount: result.failureCount,
    prunedTokenUids,
    source: options.source,
    dryRun: false,
  });

  return {
    threadId: input.threadId,
    replyId: input.replyId,
    actorUid: input.actorUid,
    recipientCount: recipientUids.size,
    uniqueTokenCount: tokens.length,
    missingTokenUids,
    dryRun: false,
    successCount: result.successCount,
    failureCount: result.failureCount,
    prunedTokenUids,
  };
};

/**
 * Triggers when a new forum reply is created.
 * Sends FCM push to thread participants (thread author + recent repliers),
 * excluding the user who wrote the new reply.
 */
export const onForumReplyCreated = functions.firestore
  .document('forum_replies/{replyId}')
  .onCreate(async (snap) => {
    try {
      const reply = snap.data();
      if (!reply) return null;

      const threadId: string = reply.threadId ?? '';
      const actorUid: string = reply.authorUid ?? '';
      const actorName: string = reply.authorName ?? 'Наставник';
      if (!threadId) return null;

      await deliverForumReplyNotification({
        threadId,
        replyId: snap.id,
        actorUid,
        actorName,
      }, {
        source: 'trigger',
      });

      return null;
    } catch (err) {
      console.error('[onForumReplyCreated]', err);
      return null;
    }
  });

/**
 * Authenticated manual replay path for forum push notification validation.
 * Allows production-safe dry-run (recipient/token resolution only) and live replay.
 */
export const replayForumReplyNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
  }

  const callerUid = context.auth.uid;
  const threadId = typeof data?.threadId === 'string' ? data.threadId.trim() : '';
  const replyId = typeof data?.replyId === 'string' ? data.replyId.trim() : '';
  const dryRun = data?.dryRun !== false;

  if (!threadId) {
    throw new functions.https.HttpsError('invalid-argument', 'threadId is required.');
  }

  const db = admin.firestore();
  const callerRole = await getUserRole(callerUid);
  const isPrivileged = callerRole === 'admin' || callerRole === 'school_admin';

  const threadSnap = await db.collection('forum_threads').doc(threadId).get();
  if (!threadSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'threadId not found.');
  }
  const thread = threadSnap.data() ?? {};
  const threadAuthorUid = typeof thread.authorUid === 'string' ? thread.authorUid : '';

  let callerIsParticipant = false;
  if (!isPrivileged && callerUid !== threadAuthorUid) {
    const participantSnap = await db
      .collection('forum_replies')
      .where('threadId', '==', threadId)
      .where('authorUid', '==', callerUid)
      .limit(1)
      .get();
    callerIsParticipant = !participantSnap.empty;
    if (!callerIsParticipant) {
      throw new functions.https.HttpsError('permission-denied', 'Replay allowed only for thread participants or admins.');
    }
  }

  let actorUid = callerUid;
  let actorName = 'Manual Replay';
  let effectiveReplyId = replyId || `manual-${Date.now()}`;

  if (replyId) {
    const replySnap = await db.collection('forum_replies').doc(replyId).get();
    if (!replySnap.exists) {
      throw new functions.https.HttpsError('not-found', 'replyId not found.');
    }
    const reply = replySnap.data() ?? {};
    const replyThreadId = typeof reply.threadId === 'string' ? reply.threadId : '';
    if (replyThreadId !== threadId) {
      throw new functions.https.HttpsError('invalid-argument', 'replyId does not belong to provided threadId.');
    }
    const replyAuthorUid = typeof reply.authorUid === 'string' ? reply.authorUid : '';
    if (!isPrivileged && replyAuthorUid && replyAuthorUid !== callerUid) {
      throw new functions.https.HttpsError('permission-denied', 'Replay cannot impersonate another author.');
    }
    actorUid = replyAuthorUid || actorUid;
    actorName = typeof reply.authorName === 'string' && reply.authorName ? reply.authorName : actorName;
    effectiveReplyId = replyId;
  }

  console.info('[replayForumReplyNotification] authorized replay', {
    callerUid,
    callerRole,
    threadId,
    replyId: effectiveReplyId,
    dryRun,
    isPrivileged,
    callerIsParticipant,
  });

  const result = await deliverForumReplyNotification({
    threadId,
    replyId: effectiveReplyId,
    actorUid,
    actorName,
  }, {
    source: 'manual_replay',
    dryRun,
  });

  return {
    ok: true,
    ...result,
  };
});

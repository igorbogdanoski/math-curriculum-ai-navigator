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
      const tokens: string[] = [];
      const tokenFetches = Array.from(recipientUids).map(uid =>
        admin.firestore().collection('user_tokens').doc(`${uid}_web`).get()
          .then(doc => { if (doc.exists) { const t = doc.data()?.token; if (t) tokens.push(t); } })
          .catch(() => { /* token missing — skip */ })
      );
      await Promise.all(tokenFetches);

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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onScenarioPublishedEmbed = exports.grantDemoCredits = exports.grantReferralBonus = exports.replayForumReplyNotification = exports.onForumReplyCreated = exports.deductCredits = exports.aggregateStudentProgress = exports.onAssignmentCreated = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const crypto = require("crypto");
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
exports.onAssignmentCreated = functions.firestore
    .document('assignments/{assignmentId}')
    .onCreate(async (snap) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    try {
        const assignment = snap.data();
        if (!assignment)
            return null;
        const teacherUid = (_a = assignment.teacherUid) !== null && _a !== void 0 ? _a : '';
        const title = (_b = assignment.title) !== null && _b !== void 0 ? _b : 'Нова задача';
        const cacheId = (_c = assignment.cacheId) !== null && _c !== void 0 ? _c : '';
        const className = (_d = assignment.classId) !== null && _d !== void 0 ? _d : '';
        // 1. Get assigning teacher's schoolId
        const teacherSnap = await admin.firestore().collection('users').doc(teacherUid).get();
        const schoolId = (_f = (_e = teacherSnap.data()) === null || _e === void 0 ? void 0 : _e.schoolId) !== null && _f !== void 0 ? _f : '';
        // Collect recipient UIDs (exclude the assigning teacher)
        const recipientUids = new Set();
        if (schoolId) {
            const schoolSnap = await admin.firestore().collection('schools').doc(schoolId).get();
            const schoolData = schoolSnap.data();
            // Add school teachers
            for (const uid of ((_g = schoolData === null || schoolData === void 0 ? void 0 : schoolData.teacherUids) !== null && _g !== void 0 ? _g : [])) {
                if (uid !== teacherUid)
                    recipientUids.add(uid);
            }
            // Add school admins
            for (const uid of ((_h = schoolData === null || schoolData === void 0 ? void 0 : schoolData.adminUids) !== null && _h !== void 0 ? _h : [])) {
                if (uid !== teacherUid)
                    recipientUids.add(uid);
            }
        }
        if (recipientUids.size === 0)
            return null;
        // 2. Fetch FCM tokens for recipients
        const tokenSet = new Set();
        await Promise.all(Array.from(recipientUids).map(async (uid) => {
            var _a;
            try {
                const doc = await admin.firestore().collection('user_tokens').doc(`${uid}_web`).get();
                const t = (_a = doc.data()) === null || _a === void 0 ? void 0 : _a.token;
                if (typeof t === 'string' && t.length > 0)
                    tokenSet.add(t);
            }
            catch ( /* token missing — skip */_b) { /* token missing — skip */ }
        }));
        const tokens = Array.from(tokenSet);
        if (tokens.length === 0)
            return null;
        // 3. Send FCM multicast
        const teacherName = (_k = (_j = teacherSnap.data()) === null || _j === void 0 ? void 0 : _j.name) !== null && _k !== void 0 ? _k : 'Наставник';
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
    }
    catch (err) {
        console.error('[onAssignmentCreated]', err);
        return null;
    }
});
/**
 * Cloud Function to aggregate student progress.
 * Triggered whenever a student completes a concept (document written in \student_progress\ collection).
 * This offloads the heavy aggregation calculation from the client, saving Firestore reads limit.
 */
exports.aggregateStudentProgress = functions.firestore
    .document('student_progress/{progressId}')
    .onWrite(async (change, _context) => {
    const data = change.after.exists ? change.after.data() : null;
    if (!data)
        return null; // Document was deleted
    const userId = data.studentId;
    const gradeLevel = data.gradeLevel;
    if (!userId || !gradeLevel)
        return null;
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
exports.deductCredits = functions.https.onCall(async (data, context) => {
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
            const currentBalance = (userData === null || userData === void 0 ? void 0 : userData.aiCreditsBalance) || 0;
            // Bypass for admin/premium/unlimited tiers — server mirrors client isUnlimitedProfile()
            const userTier = userData === null || userData === void 0 ? void 0 : userData.tier;
            const proExpiresAt = userData === null || userData === void 0 ? void 0 : userData.proExpiresAt;
            const proExpired = proExpiresAt ? new Date(proExpiresAt) < new Date() : false;
            const isProActive = (userTier === 'Pro' || (userData === null || userData === void 0 ? void 0 : userData.isPremium) === true) && !proExpired;
            if ((userData === null || userData === void 0 ? void 0 : userData.role) === 'admin' || (userData === null || userData === void 0 ? void 0 : userData.hasUnlimitedCredits) || isProActive || userTier === 'School' || userTier === 'Unlimited') {
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
    }
    catch (error) {
        console.error('Error deducting credits:', error);
        throw new functions.https.HttpsError('internal', 'Transaction failed: ' + error.message);
    }
});
const getUserRole = async (uid) => {
    var _a;
    const snap = await admin.firestore().collection('users').doc(uid).get();
    const role = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.role;
    return typeof role === 'string' ? role : '';
};
const deliverForumReplyNotification = async (input, options) => {
    var _a, _b, _c;
    const db = admin.firestore();
    const threadSnap = await db.collection('forum_threads').doc(input.threadId).get();
    if (!threadSnap.exists) {
        throw new Error(`Thread not found: ${input.threadId}`);
    }
    const thread = (_a = threadSnap.data()) !== null && _a !== void 0 ? _a : {};
    const threadAuthorUid = (_b = thread.authorUid) !== null && _b !== void 0 ? _b : '';
    const threadTitle = (_c = thread.title) !== null && _c !== void 0 ? _c : 'Форум нишка';
    const recipientUids = new Set();
    if (threadAuthorUid && threadAuthorUid !== input.actorUid) {
        recipientUids.add(threadAuthorUid);
    }
    const participantsSnap = await db
        .collection('forum_replies')
        .where('threadId', '==', input.threadId)
        .limit(50)
        .get();
    participantsSnap.docs.forEach((docSnap) => {
        var _a, _b;
        const participantUid = ((_b = (_a = docSnap.data()) === null || _a === void 0 ? void 0 : _a.authorUid) !== null && _b !== void 0 ? _b : '');
        if (!participantUid || participantUid === input.actorUid)
            return;
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
    const tokenToUid = new Map();
    const missingTokenUids = [];
    await Promise.all(Array.from(recipientUids).map(async (uid) => {
        var _a;
        try {
            const tokenSnap = await db.collection('user_tokens').doc(`${uid}_web`).get();
            const token = (_a = tokenSnap.data()) === null || _a === void 0 ? void 0 : _a.token;
            if (typeof token === 'string' && token.length > 0) {
                if (!tokenToUid.has(token))
                    tokenToUid.set(token, uid);
            }
            else {
                missingTokenUids.push(uid);
            }
        }
        catch (_b) {
            missingTokenUids.push(uid);
        }
    }));
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
    const prunedTokenUids = [];
    if (result.failureCount > 0) {
        const stalePruneOps = [];
        result.responses.forEach((resp, idx) => {
            var _a, _b;
            if (resp.success)
                return;
            const code = (_b = (_a = resp.error) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : '';
            const isStale = code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token' ||
                code === 'messaging/invalid-argument';
            if (!isStale)
                return;
            const token = tokens[idx];
            const uid = token ? tokenToUid.get(token) : undefined;
            if (!uid)
                return;
            prunedTokenUids.push(uid);
            stalePruneOps.push(db.collection('user_tokens').doc(`${uid}_web`).delete().catch(() => undefined));
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
exports.onForumReplyCreated = functions.firestore
    .document('forum_replies/{replyId}')
    .onCreate(async (snap) => {
    var _a, _b, _c;
    try {
        const reply = snap.data();
        if (!reply)
            return null;
        const threadId = (_a = reply.threadId) !== null && _a !== void 0 ? _a : '';
        const actorUid = (_b = reply.authorUid) !== null && _b !== void 0 ? _b : '';
        const actorName = (_c = reply.authorName) !== null && _c !== void 0 ? _c : 'Наставник';
        if (!threadId)
            return null;
        await deliverForumReplyNotification({
            threadId,
            replyId: snap.id,
            actorUid,
            actorName,
        }, {
            source: 'trigger',
        });
        return null;
    }
    catch (err) {
        console.error('[onForumReplyCreated]', err);
        return null;
    }
});
/**
 * Authenticated manual replay path for forum push notification validation.
 * Allows production-safe dry-run (recipient/token resolution only) and live replay.
 */
exports.replayForumReplyNotification = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication is required.');
    }
    const callerUid = context.auth.uid;
    const threadId = typeof (data === null || data === void 0 ? void 0 : data.threadId) === 'string' ? data.threadId.trim() : '';
    const replyId = typeof (data === null || data === void 0 ? void 0 : data.replyId) === 'string' ? data.replyId.trim() : '';
    const dryRun = (data === null || data === void 0 ? void 0 : data.dryRun) !== false;
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
    const thread = (_b = threadSnap.data()) !== null && _b !== void 0 ? _b : {};
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
        const reply = (_c = replySnap.data()) !== null && _c !== void 0 ? _c : {};
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
    return Object.assign({ ok: true }, result);
});
// ── Referral bonus — grant +10 credits to both referrer and new user ────────
const REFERRAL_BONUS = 10;
exports.grantReferralBonus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const newUserUid = typeof data.newUserUid === 'string' ? data.newUserUid.trim() : '';
    const refCode = typeof data.refCode === 'string' ? data.refCode.trim() : '';
    if (!newUserUid || !refCode) {
        throw new functions.https.HttpsError('invalid-argument', 'newUserUid and refCode are required.');
    }
    if (newUserUid === refCode) {
        throw new functions.https.HttpsError('invalid-argument', 'Self-referral is not allowed.');
    }
    const db = admin.firestore();
    // Idempotency: check if this referral was already processed
    const refDocId = `${refCode}_${newUserUid}`;
    const refDocRef = db.collection('referrals').doc(refDocId);
    return await db.runTransaction(async (tx) => {
        var _a, _b, _c, _d, _e;
        const refDoc = await tx.get(refDocRef);
        if (refDoc.exists && ((_a = refDoc.data()) === null || _a === void 0 ? void 0 : _a.bonusGranted) === true) {
            return { success: true, alreadyGranted: true };
        }
        const referrerRef = db.collection('users').doc(refCode);
        const newUserRef = db.collection('users').doc(newUserUid);
        const [referrerSnap, newUserSnap] = await Promise.all([
            tx.get(referrerRef),
            tx.get(newUserRef),
        ]);
        if (!referrerSnap.exists || !newUserSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'One or both users not found.');
        }
        const referrerBalance = (_c = (_b = referrerSnap.data()) === null || _b === void 0 ? void 0 : _b.aiCreditsBalance) !== null && _c !== void 0 ? _c : 0;
        const newUserBalance = (_e = (_d = newUserSnap.data()) === null || _d === void 0 ? void 0 : _d.aiCreditsBalance) !== null && _e !== void 0 ? _e : 0;
        tx.update(referrerRef, { aiCreditsBalance: referrerBalance + REFERRAL_BONUS });
        tx.update(newUserRef, { aiCreditsBalance: newUserBalance + REFERRAL_BONUS });
        tx.set(refDocRef, {
            refCode,
            newUserUid,
            bonusGranted: true,
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, alreadyGranted: false };
    });
});
// ── Demo credits — admin-only grant for webinar/demo sessions ───────────────
exports.grantDemoCredits = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    // Only admins can grant demo credits
    const db = admin.firestore();
    const callerSnap = await db.collection('users').doc(context.auth.uid).get();
    const callerRole = (_b = (_a = callerSnap.data()) === null || _a === void 0 ? void 0 : _a.role) !== null && _b !== void 0 ? _b : '';
    if (callerRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can grant demo credits.');
    }
    const targetUid = typeof data.targetUid === 'string' ? data.targetUid.trim() : '';
    const amount = typeof data.amount === 'number' && data.amount > 0 ? Math.min(data.amount, 500) : 50;
    if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }
    const userRef = db.collection('users').doc(targetUid);
    return await db.runTransaction(async (tx) => {
        var _a, _b;
        const snap = await tx.get(userRef);
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', 'Target user not found.');
        }
        const current = (_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.aiCreditsBalance) !== null && _b !== void 0 ? _b : 0;
        tx.update(userRef, { aiCreditsBalance: current + amount });
        return { success: true, newBalance: current + amount };
    });
});
// ── RAG: embed published scenarios into concept_embeddings ────────────────
/**
 * Whenever a `scenario_bank` entry becomes public (e.g. after a teacher publishes
 * an uploaded-and-audited scenario, or any manually authored plan), embed its
 * denormalised scenario text via the Gemini embedding API and write it to
 * `concept_embeddings`, so future lesson-plan generation (services/gemini/plans.ts
 * fetchScenarioBankContext / searchSimilarContext) can retrieve it semantically —
 * not just via the existing grade/topic Firestore filter.
 *
 * Runs server-side (Admin SDK) specifically because `concept_embeddings` write
 * access is admin-only in firestore.rules — this keeps that restriction intact
 * instead of loosening it for client writes.
 *
 * Requires GEMINI_API_KEY to be configured for the functions runtime (e.g. via
 * `functions/.env` or `firebase functions:secrets:set GEMINI_API_KEY`).
 */
const EMBED_MODEL = 'gemini-embedding-2';
const EMBEDDABLE_ENTRY_TYPES = new Set([undefined, 'lesson_plan']);
function hashText(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}
function buildScenarioEmbedText(entry) {
    return [
        entry.title,
        entry.topicTitle,
        entry.scenarioIntro,
        ...(Array.isArray(entry.scenarioMain) ? entry.scenarioMain : []),
        entry.scenarioConcluding,
    ].filter((v) => typeof v === 'string' && v.trim().length > 0)
        .join('\n\n')
        .slice(0, 8000); // cap — embedding APIs have input token limits
}
exports.onScenarioPublishedEmbed = functions.firestore
    .document('scenario_bank/{entryId}')
    .onWrite(async (change, context) => {
    var _a, _b, _c, _d, _e;
    const entryId = context.params.entryId;
    const embedRef = admin.firestore().collection('concept_embeddings').doc(`scenario_${entryId}`);
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;
    // Deleted, unpublished, or not an embeddable entry type — clean up any stale embedding.
    if (!after || !after.isPublic || after.deleted || !EMBEDDABLE_ENTRY_TYPES.has(after.entryType)) {
        if (before === null || before === void 0 ? void 0 : before.isPublic) {
            await embedRef.delete().catch(() => { });
        }
        return null;
    }
    const text = buildScenarioEmbedText(after);
    if (!text.trim())
        return null;
    const contentHash = hashText(text);
    const existing = await embedRef.get();
    if (existing.exists && ((_a = existing.data()) === null || _a === void 0 ? void 0 : _a.contentHash) === contentHash) {
        return null; // unchanged content — avoid paying for a redundant embedding call
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('[onScenarioPublishedEmbed] GEMINI_API_KEY not configured — skipping embed for', entryId);
        return null;
    }
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: `models/${EMBED_MODEL}`,
                content: { parts: [{ text }] },
                taskType: 'RETRIEVAL_DOCUMENT',
                outputDimensionality: 768,
            }),
        });
        if (!res.ok) {
            console.error('[onScenarioPublishedEmbed] embed API error', res.status, await res.text());
            return null;
        }
        const json = await res.json();
        const vector = (_b = json.embedding) === null || _b === void 0 ? void 0 : _b.values;
        if (!vector) {
            console.error('[onScenarioPublishedEmbed] no embedding vector returned for', entryId);
            return null;
        }
        await embedRef.set({
            vector,
            text,
            grade: (_c = after.grade) !== null && _c !== void 0 ? _c : null,
            secondaryTrack: (_d = after.secondaryTrack) !== null && _d !== void 0 ? _d : null,
            topicTitle: (_e = after.topicTitle) !== null && _e !== void 0 ? _e : '',
            source: 'scenario_bank',
            sourceScenarioId: entryId,
            contentHash,
            model: EMBED_MODEL,
            indexedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
    }
    catch (err) {
        console.error('[onScenarioPublishedEmbed] embedding failed for', entryId, err);
        return null;
    }
});
//# sourceMappingURL=index.js.map
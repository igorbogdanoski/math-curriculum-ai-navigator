"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyDuggaSubmission = exports.onAnnualPlanForked = exports.onDuggaTestAdapted = exports.onScenarioForkedOrRated = exports.onScenarioPublishedEmbed = exports.grantDemoCredits = exports.grantReferralBonus = exports.replayForumReplyNotification = exports.onForumReplyCreated = exports.deductCredits = exports.aggregateStudentProgress = exports.onAssignmentCreated = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const crypto = require("crypto");
const duggaVerification_1 = require("./duggaVerification");
const duggaSubmissionSeal_1 = require("./duggaSubmissionSeal");
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
 * Server-authoritative mirror of services/gemini/core.constants.ts's AI_COSTS.
 * Keep these two tables in sync when adding/changing a material type's price.
 */
const AI_COSTS = {
    TEXT_BASIC: 1,
    ILLUSTRATION: 5,
    PRESENTATION: 10,
    BULK: 5,
    LEARNING_PATH: 3,
    VARIANTS: 3,
    ANNUAL_PLAN: 10,
};
/**
 * Cloud Function to securely deduct AI credits from a user's balance.
 * Protects against client-side tampering of the aiCreditsBalance field —
 * and, critically, against a tampered client under-reporting the deduction
 * amount itself: the caller names which cost bucket(s) applied (e.g.
 * ['TEXT_BASIC'] or ['TEXT_BASIC', 'ILLUSTRATION']), and the actual credit
 * cost is looked up here from the server's own price table, never trusted
 * as a raw number from the client.
 */
exports.deductCredits = functions.https.onCall(async (data, context) => {
    // Ensure the user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in to deduct credits.');
    }
    const uid = context.auth.uid;
    const costKeys = data.costKeys;
    if (!Array.isArray(costKeys) || costKeys.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'costKeys must be a non-empty array of known cost identifiers.');
    }
    let amountToDeduct = 0;
    for (const key of costKeys) {
        const cost = typeof key === 'string' ? AI_COSTS[key] : undefined;
        if (cost === undefined) {
            throw new functions.https.HttpsError('invalid-argument', `Unknown cost key: ${String(key)}`);
        }
        amountToDeduct += cost;
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
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
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
    // A caller may only claim a referral bonus for themselves — without this, any
    // authenticated caller could pass two arbitrary existing UIDs and farm free
    // credits into accounts they don't own (idempotency alone doesn't prevent this,
    // since each {refCode}_{newUserUid} pair is only ever consumed once, not blocked
    // from being claimed by a non-owner).
    if (newUserUid !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'You may only claim a referral bonus for your own account.');
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
// ── Fork / rate / adapt notifications ──────────────────────────────────────
/**
 * Notifies a teacher via FCM when someone forks, adapts, or rates their
 * shared content (Scenario Bank entries, Dugga tests, Annual Plans).
 * Reuses the single-token-lookup + sendEachForMulticast + stale-token-pruning
 * pattern from deliverForumReplyNotification, scoped down to one recipient.
 */
const notifyUid = async (uid, notification) => {
    var _a, _b, _c;
    if (!uid)
        return;
    const db = admin.firestore();
    const tokenSnap = await db.collection('user_tokens').doc(`${uid}_web`).get();
    const token = (_a = tokenSnap.data()) === null || _a === void 0 ? void 0 : _a.token;
    if (typeof token !== 'string' || !token)
        return;
    try {
        const result = await admin.messaging().sendEachForMulticast({
            tokens: [token],
            notification: { title: notification.title, body: notification.body },
            webpush: {
                notification: { icon: '/icon-192.svg', badge: '/icon-192.svg' },
                fcmOptions: { link: notification.link },
                headers: { TTL: '86400' },
            },
            data: notification.data,
        });
        const failure = result.responses[0];
        if (!failure.success) {
            const code = (_c = (_b = failure.error) === null || _b === void 0 ? void 0 : _b.code) !== null && _c !== void 0 ? _c : '';
            const isStale = code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token' ||
                code === 'messaging/invalid-argument';
            if (isStale) {
                await db.collection('user_tokens').doc(`${uid}_web`).delete().catch(() => undefined);
            }
        }
    }
    catch (err) {
        console.error('[notifyUid] send failed for', uid, err);
    }
};
const getUserName = async (uid) => {
    var _a;
    const snap = await admin.firestore().collection('users').doc(uid).get();
    const name = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.name;
    return typeof name === 'string' && name ? name : 'Наставник';
};
/** Notifies the original author when their Scenario Bank entry is forked, and when it's rated. */
exports.onScenarioForkedOrRated = functions.firestore
    .document('scenario_bank/{entryId}')
    .onWrite(async (change, context) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const entryId = context.params.entryId;
        const after = change.after.exists ? change.after.data() : null;
        const before = change.before.exists ? change.before.data() : null;
        if (!after)
            return null;
        // New fork/adapt — notify the original author.
        if (!before) {
            const originalAuthorUid = (_a = after.originalAuthorUid) !== null && _a !== void 0 ? _a : '';
            if (originalAuthorUid && originalAuthorUid !== after.authorUid) {
                const forkerName = await getUserName((_b = after.authorUid) !== null && _b !== void 0 ? _b : '');
                await notifyUid(originalAuthorUid, {
                    title: `🍴 ${forkerName} го форкна твоето сценарио`,
                    body: (_c = after.title) !== null && _c !== void 0 ? _c : 'Сценарио',
                    link: `/#/scenario-bank`,
                    data: { type: 'scenario_forked', entryId, actorUid: (_d = after.authorUid) !== null && _d !== void 0 ? _d : '' },
                });
            }
            return null;
        }
        // Rating change — notify the entry's own author.
        const beforeRatings = (_e = before.ratingsByUid) !== null && _e !== void 0 ? _e : {};
        const afterRatings = (_f = after.ratingsByUid) !== null && _f !== void 0 ? _f : {};
        const authorUid = (_g = after.authorUid) !== null && _g !== void 0 ? _g : '';
        for (const [raterUid, rating] of Object.entries(afterRatings)) {
            if (beforeRatings[raterUid] === rating)
                continue; // unchanged
            if (raterUid === authorUid)
                continue; // self-rating — no notification needed
            const raterName = await getUserName(raterUid);
            await notifyUid(authorUid, {
                title: `⭐ ${raterName} го оцени твоето сценарио`,
                body: `${(_h = after.title) !== null && _h !== void 0 ? _h : 'Сценарио'} — ${rating}★`,
                link: `/#/scenario-bank`,
                data: { type: 'scenario_rated', entryId, actorUid: raterUid },
            });
        }
        return null;
    }
    catch (err) {
        console.error('[onScenarioForkedOrRated]', err);
        return null;
    }
});
/** Notifies the original author when their Dugga test is adapted by another teacher. */
exports.onDuggaTestAdapted = functions.firestore
    .document('dugga_tests/{testId}')
    .onCreate(async (snap) => {
    var _a, _b, _c, _d, _e;
    try {
        const test = snap.data();
        if (!test)
            return null;
        const originalAuthorUid = (_a = test.originalAuthorUid) !== null && _a !== void 0 ? _a : '';
        if (!originalAuthorUid || originalAuthorUid === test.teacherUid)
            return null;
        await notifyUid(originalAuthorUid, {
            title: `🍴 ${(_b = test.teacherName) !== null && _b !== void 0 ? _b : 'Наставник'} го адаптираше твојот тест`,
            body: (_d = (_c = test.adaptedFromTitle) !== null && _c !== void 0 ? _c : test.title) !== null && _d !== void 0 ? _d : 'Дига тест',
            link: `/#/dugga/library`,
            data: { type: 'dugga_adapted', testId: snap.id, actorUid: (_e = test.teacherUid) !== null && _e !== void 0 ? _e : '' },
        });
        return null;
    }
    catch (err) {
        console.error('[onDuggaTestAdapted]', err);
        return null;
    }
});
/** Notifies the original author when their Annual Plan is forked by another teacher. */
exports.onAnnualPlanForked = functions.firestore
    .document('academic_annual_plans/{planId}')
    .onCreate(async (snap) => {
    var _a, _b, _c, _d, _e;
    try {
        const plan = snap.data();
        if (!plan)
            return null;
        if (!plan.isForked)
            return null;
        const originalAuthorUid = (_a = plan.originalAuthorUid) !== null && _a !== void 0 ? _a : '';
        if (!originalAuthorUid || originalAuthorUid === plan.userId)
            return null;
        const forkerName = await getUserName((_b = plan.userId) !== null && _b !== void 0 ? _b : '');
        await notifyUid(originalAuthorUid, {
            title: `🍴 ${forkerName} го форкна твојот годишен план`,
            body: `${(_c = plan.subject) !== null && _c !== void 0 ? _c : ''} — ${(_d = plan.grade) !== null && _d !== void 0 ? _d : ''}`.trim(),
            link: `/#/annual-plans`,
            data: { type: 'annual_plan_forked', planId: snap.id, actorUid: (_e = plan.userId) !== null && _e !== void 0 ? _e : '' },
        });
        return null;
    }
    catch (err) {
        console.error('[onAnnualPlanForked]', err);
        return null;
    }
});
// ── Dugga submission integrity check ─────────────────────────────────────────
/**
 * Re-derives the score for every deterministic-type question (see
 * duggaVerification.ts for exactly which types) from the test's real answer key
 * and the student's stored raw answers, instead of trusting the client-submitted
 * score/percentage outright. Does NOT overwrite the trusted score automatically —
 * a bug in this re-implementation could otherwise corrupt a legitimate result.
 * Instead it stamps a `serverVerification` field a teacher can use to spot
 * fabricated submissions; CAS/complex-grader question types are listed as
 * unverified rather than guessed at.
 */
exports.verifyDuggaSubmission = functions.firestore
    .document('dugga_submissions/{subId}')
    .onCreate(async (snap) => {
    var _a, _b, _c, _d;
    try {
        const submission = snap.data();
        if (!(submission === null || submission === void 0 ? void 0 : submission.testId) || !(submission === null || submission === void 0 ? void 0 : submission.answers))
            return null;
        const testSnap = await admin.firestore().collection('dugga_tests').doc(submission.testId).get();
        if (!testSnap.exists)
            return null;
        const test = testSnap.data();
        const questions = ((_a = test === null || test === void 0 ? void 0 : test.questions) !== null && _a !== void 0 ? _a : []).map((q) => ({
            id: q.id,
            type: q.type,
            points: q.points,
            options: q.options,
            correctAnswer: q.correctAnswer,
            matchPairs: q.matchPairs,
            orderItems: q.orderItems,
        }));
        const { verifiedEarned, verifiedMax, unverifiedQuestionIds } = (0, duggaVerification_1.verifyDeterministicQuestions)(questions, submission.answers);
        const clientScore = Number((_b = submission.score) !== null && _b !== void 0 ? _b : 0);
        const clientTotal = Number((_c = submission.totalPoints) !== null && _c !== void 0 ? _c : 0);
        // Only compare the portion of the test this function can actually verify —
        // the unverified (CAS/complex-grader) questions' points are excluded from
        // both sides so they don't produce a false-positive mismatch.
        const unverifiedMax = clientTotal - verifiedMax >= 0 ? clientTotal - verifiedMax : 0;
        const clientVerifiablePortion = Math.max(0, clientScore - unverifiedMax);
        const discrepancy = verifiedMax > 0 ? Math.abs(clientVerifiablePortion - verifiedEarned) : 0;
        const matches = verifiedMax === 0 || discrepancy <= 0.01;
        let sealValid = null;
        if ((test === null || test === void 0 ? void 0 : test.finalExamMode) && submission.submissionSeal) {
            sealValid = (0, duggaSubmissionSeal_1.verifySubmissionSeal)({ testId: submission.testId, studentUid: (_d = submission.studentUid) !== null && _d !== void 0 ? _d : '', answers: submission.answers }, submission.submissionSeal);
        }
        await snap.ref.update({
            serverVerification: Object.assign({ checkedAt: admin.firestore.FieldValue.serverTimestamp(), verifiedEarned,
                verifiedMax,
                matches,
                unverifiedQuestionIds }, (sealValid !== null ? { sealValid } : {})),
        });
        if (!matches || sealValid === false) {
            console.warn('[verifyDuggaSubmission] discrepancy or seal mismatch', {
                subId: snap.id, testId: submission.testId, studentUid: submission.studentUid,
                clientScore, verifiedEarned, verifiedMax, sealValid,
            });
        }
        return null;
    }
    catch (err) {
        console.error('[verifyDuggaSubmission]', err);
        return null;
    }
});
//# sourceMappingURL=index.js.map
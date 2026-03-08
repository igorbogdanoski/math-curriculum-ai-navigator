"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deductCredits = exports.aggregateStudentProgress = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();
/**
 * Cloud Function to aggregate student progress.
 * Triggered whenever a student completes a concept (document written in \student_progress\ collection).
 * This offloads the heavy aggregation calculation from the client, saving Firestore reads limit.
 */
exports.aggregateStudentProgress = functions.firestore
    .document('student_progress/{progressId}')
    .onWrite(async (change, context) => {
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
            // Allow bypass if they are premium/admin/unlimited (just in case they call it anyway)
            if ((userData === null || userData === void 0 ? void 0 : userData.role) === 'admin' || (userData === null || userData === void 0 ? void 0 : userData.isPremium) || (userData === null || userData === void 0 ? void 0 : userData.hasUnlimitedCredits)) {
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
//# sourceMappingURL=index.js.map
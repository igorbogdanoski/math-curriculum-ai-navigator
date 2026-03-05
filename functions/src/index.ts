import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();

/**
 * Cloud Function to aggregate student progress.
 * Triggered whenever a student completes a concept (document written in \student_progress\ collection).
 * This offloads the heavy aggregation calculation from the client, saving Firestore reads limit.
 */
export const aggregateStudentProgress = functions.firestore
  .document('student_progress/{progressId}')
  .onWrite(async (change, context) => {
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

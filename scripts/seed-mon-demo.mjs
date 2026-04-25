#!/usr/bin/env node
/**
 * scripts/seed-mon-demo.mjs — S41-D1 MON demo seed
 *
 * Creates a deterministic demo workspace for МОН reviewers:
 *   • teacher@mon-demo.ai.mismath.net (admin-ish teacher account)
 *   • student1..student12@mon-demo.ai.mismath.net
 *   • 3 годишни планови (annual plans) per teacher
 *   • 8 квизови (DoK 1–4 mix) — public, attached to known concepts
 *   • 12 ученички профили со scripted score history
 *   • 5 forum threads
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./firebase-adminsdk-key.json \
 *     node scripts/seed-mon-demo.mjs [--dry-run] [--reset]
 *
 *   --dry-run  Print what would be written; no Firestore writes / Auth calls.
 *   --reset    Delete all docs the previous seed produced before re-seeding.
 *
 * Idempotent: every doc uses a stable seed-derived ID prefixed with `mon-demo-`.
 */

import crypto from 'node:crypto';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const reset  = args.includes('--reset');

const DEMO_DOMAIN     = 'mon-demo.ai.mismath.net';
const DEMO_PREFIX     = 'mon-demo-';
const TEACHER_EMAIL   = `teacher@${DEMO_DOMAIN}`;
const STUDENT_COUNT   = 12;
const ANNUAL_PLANS    = 3;
const QUIZ_COUNT      = 8;
const FORUM_THREADS   = 5;
const DEMO_PASSWORD   = process.env.MON_DEMO_PASSWORD || 'MonDemo!2026';

function id(scope, key) {
  return `${DEMO_PREFIX}${scope}-${key}`;
}

function deterministicScore(studentIdx, quizIdx) {
  const h = crypto.createHash('sha256').update(`${studentIdx}|${quizIdx}`).digest();
  return 40 + (h[0] % 60); // 40..99
}

function buildSeedPlan() {
  const teacher = {
    uid: id('uid', 'teacher'),
    email: TEACHER_EMAIL,
    displayName: 'Демо Наставник (МОН)',
    role: 'teacher',
    school: 'МОН Демо ОУ',
    subjects: ['Математика'],
    grades: [6, 7, 8, 9],
    tier: 'Pro',
    demoMode: true,
  };

  const students = Array.from({ length: STUDENT_COUNT }, (_, i) => ({
    uid: id('uid', `student${i + 1}`),
    email: `student${i + 1}@${DEMO_DOMAIN}`,
    displayName: `Демо Ученик ${i + 1}`,
    role: 'student',
    grade: 6 + (i % 4),
    teacherId: teacher.uid,
    demoMode: true,
  }));

  const annualPlans = Array.from({ length: ANNUAL_PLANS }, (_, i) => ({
    id: id('annual', `plan${i + 1}`),
    teacherId: teacher.uid,
    grade: 6 + i,
    year: '2025/2026',
    title: `Годишен план — ${6 + i}. одделение`,
    units: 8,
    createdAt: new Date('2025-09-01').toISOString(),
    demoMode: true,
  }));

  const dokRotation = [1, 2, 3, 4, 1, 2, 3, 4];
  const quizzes = Array.from({ length: QUIZ_COUNT }, (_, i) => ({
    id: id('quiz', `q${i + 1}`),
    teacherId: teacher.uid,
    grade: 6 + (i % 4),
    title: `Демо квиз ${i + 1} — DoK ${dokRotation[i]}`,
    dokLevel: dokRotation[i],
    isPublic: true,
    questionCount: 5 + (i % 4),
    conceptIds: [`g${6 + (i % 4)}-c-${(i % 5) + 1}`],
    createdAt: new Date(2025, 8, 15 + i).toISOString(),
    demoMode: true,
  }));

  const studentHistory = students.flatMap((s, sIdx) =>
    quizzes.map((q, qIdx) => ({
      id: id('history', `${sIdx + 1}-${qIdx + 1}`),
      studentId: s.uid,
      quizId: q.id,
      score: deterministicScore(sIdx, qIdx),
      submittedAt: new Date(2025, 9, 1 + qIdx, 9 + sIdx % 6).toISOString(),
      demoMode: true,
    })),
  );

  const forumThreads = Array.from({ length: FORUM_THREADS }, (_, i) => ({
    id: id('forum', `thread${i + 1}`),
    authorId: teacher.uid,
    title: [
      'Како да воведам Bloom DoK 3 за разломки во 6. одделение?',
      'Идеи за Algebra Tiles при квадратни изрази',
      'Како да користите AI Tutor за слаби ученици',
      'Споделување годишен план за 8. одделение',
      'Прашања за Матура 2025 — септември',
    ][i],
    body: 'Демо тема за МОН рецензија. Содржини се статички и не претставуваат вистински податоци.',
    replyCount: 3 + i,
    createdAt: new Date(2025, 8, 20 + i).toISOString(),
    demoMode: true,
  }));

  return { teacher, students, annualPlans, quizzes, studentHistory, forumThreads };
}

function summarise(plan) {
  console.log('\n=== MON Demo Seed Plan ===');
  console.log(`Teacher:        ${plan.teacher.email} (uid=${plan.teacher.uid})`);
  console.log(`Students:       ${plan.students.length}`);
  console.log(`Annual plans:   ${plan.annualPlans.length}`);
  console.log(`Quizzes:        ${plan.quizzes.length}  (DoK rotation 1→4)`);
  console.log(`History entries:${plan.studentHistory.length}  (students × quizzes)`);
  console.log(`Forum threads:  ${plan.forumThreads.length}`);
  console.log(`Default password: ${DEMO_PASSWORD}`);
}

async function loadAdmin() {
  let admin;
  try {
    const mod = await import('firebase-admin');
    admin = mod.default;
  } catch {
    console.error('✗ firebase-admin not installed. Run: npm install firebase-admin');
    process.exit(1);
  }
  if (!admin.apps.length) {
    const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (saEnv) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(saEnv)) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
      console.error('✗ No Firebase credentials. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.');
      process.exit(1);
    }
  }
  return admin;
}

async function ensureAuthUser(admin, email, uid, displayName) {
  try {
    await admin.auth().getUser(uid);
    return 'exists';
  } catch {
    await admin.auth().createUser({ uid, email, password: DEMO_PASSWORD, displayName, emailVerified: true });
    return 'created';
  }
}

async function deleteByDemoMode(db, collection) {
  const snap = await db.collection(collection).where('demoMode', '==', true).get();
  if (snap.empty) return 0;
  let removed = 0;
  let batch = db.batch();
  let ops = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    ops++; removed++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return removed;
}

async function writePlan(admin, plan) {
  const db = admin.firestore();

  if (reset) {
    console.log('\n▶ Reset requested — deleting prior demo docs...');
    for (const c of ['users', 'lessonPlans', 'quizzes', 'studentHistory', 'forumThreads']) {
      const removed = await deleteByDemoMode(db, c);
      console.log(`   ${c}: removed ${removed}`);
    }
  }

  console.log('\n▶ Provisioning auth users...');
  const teacherStatus = await ensureAuthUser(admin, plan.teacher.email, plan.teacher.uid, plan.teacher.displayName);
  console.log(`   teacher (${teacherStatus}): ${plan.teacher.email}`);
  for (const s of plan.students) {
    const st = await ensureAuthUser(admin, s.email, s.uid, s.displayName);
    if (st === 'created') console.log(`   student (created): ${s.email}`);
  }

  console.log('\n▶ Writing Firestore docs...');
  let batch = db.batch();
  let ops = 0;

  const queue = [
    ['users', plan.teacher.uid, plan.teacher],
    ...plan.students.map(s => ['users', s.uid, s]),
    ...plan.annualPlans.map(p => ['lessonPlans', p.id, p]),
    ...plan.quizzes.map(q => ['quizzes', q.id, q]),
    ...plan.studentHistory.map(h => ['studentHistory', h.id, h]),
    ...plan.forumThreads.map(f => ['forumThreads', f.id, f]),
  ];

  for (const [col, docId, data] of queue) {
    batch.set(db.collection(col).doc(docId), data, { merge: true });
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  console.log(`✓ Wrote ${queue.length} documents.`);
}

const plan = buildSeedPlan();
summarise(plan);

if (dryRun) {
  console.log('\n🔍 Dry-run mode — nothing written.');
  process.exit(0);
}

const admin = await loadAdmin();
await writePlan(admin, plan);
console.log('\n✓ MON demo seed complete.');

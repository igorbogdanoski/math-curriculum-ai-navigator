/**
 * migrate-community-to-bank.mjs
 *
 * One-time migration: communityLessonPlans → scenario_bank
 *
 * What it does:
 *   1. Reads every doc from `communityLessonPlans`
 *   2. Creates a matching ScenarioBankEntry in `scenario_bank`
 *   3. Converts ratings[] → ratingsByUid (synthetic UIDs)
 *   4. Preserves all content fields and the original doc ID
 *   5. Marks source doc as `migrated: true` (does NOT delete it)
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=firebase-adminsdk-key.json node scripts/migrate-community-to-bank.mjs
 *
 * Safe to re-run: skips docs where scenario_bank already has `migratedFromCommunity: true`
 * and the same `originalCommunityId`.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? 'firebase-adminsdk-key.json'),
  });
}

const db = getFirestore();
db.settings({ preferRest: true });

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractBloomLevels(plan) {
  const levels = new Set();
  for (const obj of plan.objectives ?? []) {
    if (obj.bloomsLevel) levels.add(obj.bloomsLevel);
  }
  return [...levels];
}

/** Convert flat ratings array [3, 4, 5] → { uid_0: 3, uid_1: 4, uid_2: 5 } */
function ratingsToMap(ratings) {
  const map = {};
  for (let i = 0; i < (ratings ?? []).length; i++) {
    map[`migrated_uid_${i}`] = ratings[i];
  }
  return map;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📦 Читам communityLessonPlans...');
  const snap = await db.collection('communityLessonPlans').get();
  console.log(`   Found ${snap.size} docs`);

  // Build set of already-migrated communityIds for idempotency
  const existingSnap = await db.collection('scenario_bank')
    .where('migratedFromCommunity', '==', true)
    .select('originalCommunityId')
    .get();
  const alreadyMigrated = new Set(existingSnap.docs.map(d => d.data().originalCommunityId));
  console.log(`   Already migrated: ${alreadyMigrated.size}`);

  let created = 0, skipped = 0, errors = 0;

  for (const docSnap of snap.docs) {
    const id = docSnap.id;
    const plan = docSnap.data();

    if (alreadyMigrated.has(id)) {
      skipped++;
      continue;
    }

    try {
      const entry = {
        entryType: 'lesson_plan',
        title: plan.title ?? 'Без наслов',
        grade: plan.grade ?? 0,
        subject: plan.subject ?? 'Математика',
        topicTitle: plan.theme ?? '',
        objectives: (plan.objectives ?? []).map(o => (typeof o === 'string' ? o : o.text ?? '')),
        scenarioIntro: plan.scenario?.introductory?.text ?? '',
        scenarioMain: (plan.scenario?.main ?? []).map(m => (typeof m === 'string' ? m : m.text ?? '')),
        scenarioConcluding: plan.scenario?.concluding?.text ?? '',
        materials: plan.materials ?? [],
        assessmentStandards: plan.assessmentStandards ?? [],
        fullPlan: plan,
        bloomLevels: extractBloomLevels(plan),
        dokLevel: null,
        teachingModel: null,
        duration: 40,
        authorUid: plan.authorUid ?? 'migrated',
        authorName: plan.authorName ?? 'Наставник',
        schoolName: plan.schoolName ?? '',
        originalId: null,
        forkDepth: 0,
        publishedAt: plan.createdAt ?? Timestamp.now(),
        forkCount: 0,
        usageCount: 0,
        ratingsByUid: ratingsToMap(plan.ratings),
        savedByUids: [],
        verifiedByBRO: false,
        isFeatured: false,
        deleted: false,
        isPublic: plan.shareScope !== 'school',
        authorNotes: '',
        // Migration metadata
        migratedFromCommunity: true,
        originalCommunityId: id,
      };

      await db.collection('scenario_bank').add(entry);

      // Mark source as migrated (read-only signal, does not delete)
      await db.collection('communityLessonPlans').doc(id).update({ migrated: true });

      created++;
      console.log(`   ✅ ${plan.title ?? id}`);
    } catch (err) {
      errors++;
      console.error(`   ❌ ${id}: ${err.message}`);
    }
  }

  console.log(`\n🏁 Готово — Создадено: ${created} | Прескокнато: ${skipped} | Грешки: ${errors}`);
}

main().catch(err => { console.error(err); process.exit(1); });

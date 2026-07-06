#!/usr/bin/env node
/**
 * scripts/audit-users-readonly.mjs — READ-ONLY diagnostic
 *
 * Lists every users/{uid} doc via the Firestore REST API (same auth pattern
 * as make-admin.mjs — REST, not the admin SDK/gRPC, to avoid TLS issues on
 * Windows) and reports:
 *   1. aiCreditsBalance distribution (how many are still at the 50 default)
 *   2. docs touched (Firestore updateTime) in the last N days
 *   3. duplicate `name` values across different UIDs
 *
 * Never writes anything. Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./firebase-adminsdk-key.json node scripts/audit-users-readonly.mjs
 */
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) {
  console.error('✗ GOOGLE_APPLICATION_CREDENTIALS env var not set.');
  process.exit(1);
}
const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
const PROJECT_ID = sa.project_id;
const CLIENT_EMAIL = sa.client_email;
const PRIVATE_KEY = sa.private_key;

function makeJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(PRIVATE_KEY, 'base64url');
  return `${header}.${payload}.${sig}`;
}

async function getAccessToken() {
  const jwt = makeJwt();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Failed to get access token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

function fv(fields, key, type) {
  return fields?.[key]?.[type];
}

async function main() {
  const token = await getAccessToken();
  console.log('✓ Authenticated against project', PROJECT_ID);

  let pageToken = undefined;
  const users = [];
  let page = 0;
  do {
    page++;
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`List failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    for (const doc of json.documents ?? []) {
      const f = doc.fields ?? {};
      users.push({
        uid: doc.name.split('/').pop(),
        name: fv(f, 'name', 'stringValue') ?? '(no name)',
        email: fv(f, 'email', 'stringValue'),
        aiCreditsBalance: fv(f, 'aiCreditsBalance', 'integerValue') !== undefined
          ? Number(fv(f, 'aiCreditsBalance', 'integerValue'))
          : (fv(f, 'aiCreditsBalance', 'doubleValue') ?? null),
        hasUnlimitedCredits: fv(f, 'hasUnlimitedCredits', 'booleanValue') ?? false,
        tier: fv(f, 'tier', 'stringValue') ?? '(unset)',
        schoolName: fv(f, 'schoolName', 'stringValue') ?? '',
        schoolRegistryId: fv(f, 'schoolRegistryId', 'stringValue') ?? '',
        createTime: doc.createTime,
        updateTime: doc.updateTime,
      });
    }
    pageToken = json.nextPageToken;
    console.log(`  fetched page ${page} — ${json.documents?.length ?? 0} docs (running total ${users.length})`);
  } while (pageToken);

  console.log(`\n=== TOTAL USERS: ${users.length} ===\n`);

  // 1. Credit distribution
  const at50 = users.filter(u => u.aiCreditsBalance === 50);
  const below50 = users.filter(u => u.aiCreditsBalance !== null && u.aiCreditsBalance < 50);
  const above50 = users.filter(u => u.aiCreditsBalance !== null && u.aiCreditsBalance > 50 && !u.hasUnlimitedCredits);
  const unlimited = users.filter(u => u.hasUnlimitedCredits);
  const nullCredits = users.filter(u => u.aiCreditsBalance === null && !u.hasUnlimitedCredits);
  console.log('--- Credit balance distribution ---');
  console.log(`  exactly 50 (never used / never deducted): ${at50.length}`);
  console.log(`  below 50 (real usage detected):           ${below50.length}`);
  console.log(`  above 50, not unlimited (topped up?):     ${above50.length}`);
  console.log(`  hasUnlimitedCredits:                      ${unlimited.length}`);
  console.log(`  no aiCreditsBalance field at all:          ${nullCredits.length}`);

  if (below50.length > 0) {
    console.log('\n  Sample of users WITH real deduction (up to 10):');
    below50.slice(0, 10).forEach(u => console.log(`    ${u.name} | balance=${u.aiCreditsBalance} | tier=${u.tier}`));
  }

  // 2. Recently touched docs (Firestore updateTime), last 3 days
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const recentlyUpdated = users
    .filter(u => u.updateTime && (now - new Date(u.updateTime).getTime()) <= THREE_DAYS_MS)
    .sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));
  console.log(`\n--- Docs with Firestore updateTime in the last 3 days: ${recentlyUpdated.length} ---`);
  recentlyUpdated.slice(0, 25).forEach(u =>
    console.log(`    ${u.updateTime} | ${u.name} | balance=${u.aiCreditsBalance} | tier=${u.tier}`));

  // 3. Duplicate names
  const byName = new Map();
  for (const u of users) {
    if (!byName.has(u.name)) byName.set(u.name, []);
    byName.get(u.name).push(u);
  }
  const dupes = [...byName.entries()].filter(([, list]) => list.length > 1);
  console.log(`\n--- Duplicate display names (same name, different UIDs): ${dupes.length} groups ---`);
  for (const [name, list] of dupes.slice(0, 20)) {
    console.log(`  "${name}" — ${list.length} accounts:`);
    for (const u of list) {
      console.log(`      uid=${u.uid} email=${u.email ?? '(none)'} school=${u.schoolName || '(none)'} created=${u.createTime}`);
    }
  }

  // 4. School registry usage
  const withSchoolRegistryId = users.filter(u => u.schoolRegistryId);
  const withSchoolNameNoRegistryId = users.filter(u => u.schoolName && !u.schoolRegistryId);
  const withNoSchool = users.filter(u => !u.schoolName);
  console.log('\n--- School registry usage ---');
  console.log(`  has schoolRegistryId (picked from registry):        ${withSchoolRegistryId.length}`);
  console.log(`  has schoolName but NO schoolRegistryId (free text / Google fallback / legacy): ${withSchoolNameNoRegistryId.length}`);
  console.log(`  no school at all:                                    ${withNoSchool.length}`);
}

main().catch(e => { console.error('✗', e.message); process.exit(1); });

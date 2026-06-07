#!/usr/bin/env node
/**
 * scripts/make-admin.mjs — Bootstrap a system admin account
 *
 * Finds a Firebase user by email, then updates their Firestore profile
 * to role: 'admin', isPremium: true, hasUnlimitedCredits: true, tier: 'Unlimited'.
 *
 * Uses Firestore REST API (not gRPC) to avoid TLS issues on Windows.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./firebase-adminsdk-key.json \
 *     node scripts/make-admin.mjs --email bogdanoskiigor@gmail.com
 *
 *   # Dry-run:
 *     node scripts/make-admin.mjs --email bogdanoskiigor@gmail.com --dry-run
 */

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const emailIdx = args.indexOf('--email');
const dryRun = args.includes('--dry-run');

if (emailIdx === -1 || !args[emailIdx + 1]) {
  console.error('Usage: node scripts/make-admin.mjs --email <email> [--dry-run]');
  process.exit(1);
}
const targetEmail = args[emailIdx + 1].trim();

// ─── Load service account key ──────────────────────────────────────────────────
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) {
  console.error('✗ GOOGLE_APPLICATION_CREDENTIALS env var not set.');
  process.exit(1);
}
const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
const PROJECT_ID = sa.project_id;
const CLIENT_EMAIL = sa.client_email;
const PRIVATE_KEY = sa.private_key;

// ─── Generate service account JWT ─────────────────────────────────────────────
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

// ─── Exchange JWT for access token ────────────────────────────────────────────
async function getAccessToken() {
  const jwt = makeJwt();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get access token: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.access_token;
}

// ─── Firebase Auth REST: lookup user by email ─────────────────────────────────
async function lookupByEmail(token, email) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email: [email] }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth lookup failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  if (!json.users || json.users.length === 0) {
    throw new Error(`No user found with email: ${email}`);
  }
  return json.users[0];
}

// ─── Firestore REST: get doc ───────────────────────────────────────────────────
async function firestoreGet(token, uid) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore GET failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ─── Firestore REST: patch doc (merge) ────────────────────────────────────────
async function firestorePatch(token, uid, fields) {
  const maskParams = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?${maskParams}`;

  // Convert JS values to Firestore field format
  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
    else if (typeof v === 'number') firestoreFields[k] = { integerValue: String(v) };
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: firestoreFields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore PATCH failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ─── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n▶ Getting access token for ${CLIENT_EMAIL}...`);
const token = await getAccessToken();
console.log('  ✓ Token acquired');

console.log(`\n▶ Looking up Firebase Auth user: ${targetEmail}`);
const authUser = await lookupByEmail(token, targetEmail);
const uid = authUser.localId;
console.log(`  ✓ Found UID: ${uid}`);
console.log(`  Display name: ${authUser.displayName ?? '(none)'}`);

console.log(`\n▶ Reading Firestore profile for UID: ${uid}`);
const doc = await firestoreGet(token, uid);
if (!doc) {
  console.error('✗ No Firestore profile found. The user needs to log in at least once.');
  process.exit(1);
}

// Parse current values from Firestore format
const f = doc.fields ?? {};
const get = (key, type) => f[key]?.[type] ?? '(unset)';
console.log('  Current profile:');
console.log(`    role:                ${get('role', 'stringValue')}`);
console.log(`    isPremium:           ${get('isPremium', 'booleanValue')}`);
console.log(`    hasUnlimitedCredits: ${get('hasUnlimitedCredits', 'booleanValue')}`);
console.log(`    tier:                ${get('tier', 'stringValue')}`);

const update = {
  role: 'admin',
  isPremium: true,
  hasUnlimitedCredits: true,
  tier: 'Unlimited',
};

console.log('\n  Will apply:');
for (const [k, v] of Object.entries(update)) {
  console.log(`    ${k}: → ${v}`);
}

if (dryRun) {
  console.log('\n🔍 DRY-RUN — no changes written. Remove --dry-run to apply.\n');
  process.exit(0);
}

await firestorePatch(token, uid, update);

console.log(`\n✓ Success! ${targetEmail} is now a system admin (role: admin, tier: Unlimited).`);
console.log('  Hard-refresh the app (Ctrl+Shift+R) to see the Pro Наставник badge.\n');

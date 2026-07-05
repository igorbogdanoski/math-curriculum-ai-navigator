"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableStringify = stableStringify;
exports.computeSubmissionSeal = computeSubmissionSeal;
exports.verifySubmissionSeal = verifySubmissionSeal;
/**
 * Server-side copy of utils/duggaSubmissionSeal.ts (kept in sync manually — this
 * project builds separately from the main app, see duggaVerification.ts for why).
 * Verifies the tamper-evident seal a final-exam-mode submission was stored with.
 * Uses Node's built-in `crypto` (rather than the client's Web Crypto `subtle.digest`)
 * since this runs in a Cloud Function, not a browser — same SHA-256 algorithm, so
 * digests computed here are identical to ones the client already stored.
 */
const crypto_1 = require("crypto");
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value)) {
        return `[${value.map(v => stableStringify(v)).join(',')}]`;
    }
    const keys = Object.keys(value).sort();
    return `{${keys
        .map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
        .join(',')}}`;
}
function computeSubmissionSeal(input) {
    const payload = `${input.testId}|${input.studentUid}|${stableStringify(input.answers)}`;
    return (0, crypto_1.createHash)('sha256').update(payload, 'utf8').digest('hex');
}
function verifySubmissionSeal(input, storedSeal) {
    return computeSubmissionSeal(input) === storedSeal.toLowerCase();
}
//# sourceMappingURL=duggaSubmissionSeal.js.map
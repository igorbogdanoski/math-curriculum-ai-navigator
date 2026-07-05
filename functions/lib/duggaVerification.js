"use strict";
/**
 * Server-side integrity check for `dugga_submissions` — re-derives the score for
 * every DETERMINISTIC question type from the test's actual answer key and the
 * student's stored raw answers, so a client can't simply POST a fabricated
 * score/percentage. This mirrors utils/duggaScoring.ts's `autoScore` for the
 * question types that need no extra dependency to re-verify server-side:
 * multiple_choice, checklist, true_false, statement_eval, ordering, multi_match,
 * list_items, section_header.
 *
 * NOT covered here (documented gap, not silently dropped): fill_blanks/short_answer
 * (needs the CAS engine — @cortex-js/compute-engine — not yet added to this
 * project's dependencies), function_match, proof_steps, unit_circle_pick,
 * student_chart (each needs its own dedicated grading module ported over), and
 * anything AI/manual-graded. For those, this function trusts the client-reported
 * per-question point value as-is — full parity is a follow-up, not attempted here
 * to avoid rushing a duplicate implementation of complex graders without adequate
 * testing time.
 *
 * This project builds independently from the main app (separate tsconfig/deps),
 * so this is a deliberate, documented COPY of the relevant slice of
 * utils/duggaScoring.ts, not a shared import — keep the two in sync by hand if the
 * deterministic-type grading rules ever change.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyDeterministicQuestions = verifyDeterministicQuestions;
/** Re-derives earned points for one deterministic-type question. Returns null if this
 *  question type isn't one of the ones this module can verify without a heavier port. */
function verifyOneQuestion(q, answer) {
    var _a, _b, _c, _d;
    const rawAnswer = Array.isArray(answer) ? answer.join(',') : (answer !== null && answer !== void 0 ? answer : '');
    switch (q.type) {
        case 'multiple_choice': {
            const opt = (_a = q.options) === null || _a === void 0 ? void 0 : _a.find(o => o.id === rawAnswer);
            const correct = (opt === null || opt === void 0 ? void 0 : opt.isCorrect) === true || (!!opt && opt.text === q.correctAnswer);
            return correct ? q.points : 0;
        }
        case 'checklist': {
            const selectedSet = new Set(rawAnswer ? rawAnswer.split(',').filter(Boolean) : []);
            const correctIds = ((_b = q.options) !== null && _b !== void 0 ? _b : []).filter(o => o.isCorrect).map(o => o.id);
            if (!correctIds.length)
                return null;
            const allCorrect = correctIds.length === selectedSet.size && correctIds.every(id => selectedSet.has(id));
            const hits = correctIds.filter(id => selectedSet.has(id)).length;
            const wrong = [...selectedSet].filter(id => !correctIds.includes(id)).length;
            const ratio = hits / correctIds.length;
            return allCorrect ? q.points : Math.floor(q.points * ratio * (wrong > 0 ? 0.6 : 1));
        }
        case 'true_false':
        case 'statement_eval': {
            if (!q.correctAnswer)
                return null;
            return rawAnswer.toLowerCase() === q.correctAnswer.toLowerCase() ? q.points : 0;
        }
        case 'ordering': {
            if (!((_c = q.orderItems) === null || _c === void 0 ? void 0 : _c.length))
                return null;
            const studentOrder = rawAnswer ? rawAnswer.split('|') : [];
            const correct = q.orderItems.length === studentOrder.length && q.orderItems.every((item, i) => studentOrder[i] === item);
            const hits = q.orderItems.filter((item, i) => studentOrder[i] === item).length;
            const ratio = hits / q.orderItems.length;
            return correct ? q.points : Math.floor(q.points * ratio * 0.7);
        }
        case 'multi_match': {
            if (!((_d = q.matchPairs) === null || _d === void 0 ? void 0 : _d.length))
                return null;
            let parsed = {};
            try {
                parsed = rawAnswer ? JSON.parse(rawAnswer) : {};
            }
            catch ( /* malformed → 0 hits below */_e) { /* malformed → 0 hits below */ }
            const hits = q.matchPairs.filter(p => parsed[p.left] === p.right).length;
            const correct = hits === q.matchPairs.length;
            return correct ? q.points : Math.floor(q.points * (hits / q.matchPairs.length));
        }
        case 'list_items': {
            if (!q.correctAnswer)
                return null;
            let submitted = [];
            try {
                submitted = rawAnswer ? JSON.parse(rawAnswer) : [];
            }
            catch ( /* malformed → 0 hits below */_f) { /* malformed → 0 hits below */ }
            const expected = q.correctAnswer.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            const given = submitted.map(s => s.trim().toLowerCase()).filter(Boolean);
            if (!expected.length)
                return null;
            const hits = expected.filter(e => given.includes(e)).length;
            const extra = given.filter(g => !expected.includes(g)).length;
            const correct = hits === expected.length && extra === 0;
            const ratio = hits / expected.length;
            return correct ? q.points : Math.floor(q.points * ratio * (extra > 0 ? 0.7 : 1));
        }
        case 'section_header':
            return 0;
        default:
            return null;
    }
}
function verifyDeterministicQuestions(questions, answers) {
    let verifiedEarned = 0;
    let verifiedMax = 0;
    const unverifiedQuestionIds = [];
    for (const q of questions) {
        const earned = verifyOneQuestion(q, answers[q.id]);
        if (earned === null) {
            unverifiedQuestionIds.push(q.id);
            continue;
        }
        verifiedEarned += earned;
        verifiedMax += q.points;
    }
    return { verifiedEarned, verifiedMax, unverifiedQuestionIds };
}
//# sourceMappingURL=duggaVerification.js.map
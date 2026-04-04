#!/usr/bin/env node
/**
 * D1/D2 — AI Generation Quality Evaluation Runner
 *
 * D1 mode (--validate-schema):
 *   Validates that golden-set.json is internally consistent.
 *   No AI calls. Run in CI to guard against case drift.
 *
 * D2 mode (--outputs <file>):
 *   Validates a batch of real AI outputs against the corresponding
 *   golden-set cases.  Outputs a quality score report.
 *   Appends summary to eval/score-history.json for trend tracking.
 *
 * Usage:
 *   node scripts/run-eval.mjs --validate-schema
 *   node scripts/run-eval.mjs --outputs eval/sample-outputs.json
 *   node scripts/run-eval.mjs --outputs eval/sample-outputs.json --min-score 80 --fail-below
 *   node scripts/run-eval.mjs --outputs eval/sample-outputs.json --only-provided
 *   node scripts/run-eval.mjs --filter-tag grade7 --outputs eval/sample-outputs.json
 *   node scripts/run-eval.mjs --outputs eval/sample-outputs.json --record-history
 *   node scripts/run-eval.mjs --show-trend
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCORE_HISTORY_PATH_DEFAULT = 'eval/score-history.json';
const MAX_HISTORY_ENTRIES = 100;

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const GOLDEN_SET_PATH = resolve(ROOT, 'eval', 'golden-set.json');

// ── helpers ────────────────────────────────────────────────────────────────

function loadJSON(path) {
  if (!existsSync(path)) {
    console.error(`[eval] File not found: ${path}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`[eval] Failed to parse JSON at ${path}: ${e.message}`);
    process.exit(1);
  }
}

function hasCyrillic(str) {
  return /[\u0400-\u04FF]/.test(str ?? '');
}

function normalise(str) {
  return (str ?? '').toLowerCase().trim();
}

// ── per-case validators ────────────────────────────────────────────────────

/**
 * Validate a single AI output against a golden-set case.
 * Returns { caseId, pass, score, checks }
 */
function validateOutput(goldenCase, aiOutput) {
  const { id, type, expectedCriteria } = goldenCase;
  const checks = [];

  function check(name, pass, detail) {
    checks.push({ name, pass, detail: detail ?? '' });
  }

  if (!aiOutput) {
    check('output_present', false, 'No AI output provided for this case');
    return buildResult(id, type, checks);
  }

  const criteria = expectedCriteria;

  // 1. Required fields
  for (const field of criteria.requiredFields ?? []) {
    const present = field in aiOutput && aiOutput[field] !== null && aiOutput[field] !== undefined && aiOutput[field] !== '';
    check(`required_field:${field}`, present, present ? '' : `Missing or empty field "${field}"`);
  }

  // 2. Type-specific structural checks
  if (type === 'assessment_question') {
    validateAssessmentQuestion(aiOutput, criteria, check);
  } else if (type === 'lesson_ideas') {
    validateLessonIdeas(aiOutput, criteria, check);
  } else if (type === 'step_by_step_solution') {
    validateStepByStep(aiOutput, criteria, check);
  } else if (type === 'parallel_test') {
    validateParallelTest(aiOutput, criteria, check);
  } else if (type === 'rubric') {
    validateRubric(aiOutput, criteria, check);
  } else if (type === 'annual_plan') {
    validateAnnualPlan(aiOutput, criteria, check);
  }

  return buildResult(id, type, checks);
}

function validateAssessmentQuestion(out, criteria, check) {
  // DoK level
  if (criteria.dokLevel !== undefined && out.dokLevel !== undefined) {
    const dev = Math.abs((out.dokLevel ?? 0) - criteria.dokLevel);
    const maxDev = criteria.maxDokDeviation ?? 1;
    check('dok_alignment', dev <= maxDev,
      dev <= maxDev ? '' : `Expected DoK ${criteria.dokLevel}, got ${out.dokLevel} (deviation ${dev} > ${maxDev})`);
  }

  // Bloom level
  if (criteria.bloomLevel) {
    const matches = normalise(out.cognitiveLevel) === normalise(criteria.bloomLevel);
    check('bloom_alignment', matches,
      matches ? '' : `Expected Bloom "${criteria.bloomLevel}", got "${out.cognitiveLevel}"`);
  }

  // Difficulty
  if (criteria.difficultyLevel) {
    const matches = normalise(out.difficulty_level) === normalise(criteria.difficultyLevel);
    check('difficulty_match', matches,
      matches ? '' : `Expected difficulty "${criteria.difficultyLevel}", got "${out.difficulty_level}"`);
  }

  // Options count for MC
  if (criteria.minOptions !== undefined) {
    const optCount = Array.isArray(out.options) ? out.options.length : 0;
    check('options_count', optCount >= criteria.minOptions,
      optCount >= criteria.minOptions ? '' : `Expected >= ${criteria.minOptions} options, got ${optCount}`);
  }

  // Answer present
  if (criteria.hasAnswer) {
    const hasAns = !!out.answer && String(out.answer).trim().length > 0;
    check('has_answer', hasAns, hasAns ? '' : 'Answer is missing or empty');
  }

  // Minimum question length
  const minLen = criteria.minQuestionLengthChars ?? 0;
  if (minLen > 0) {
    const len = (out.question ?? '').length;
    check('question_length', len >= minLen,
      len >= minLen ? '' : `Question too short: ${len} < ${minLen} chars`);
  }

  // Language (Cyrillic)
  if (criteria.languageCode === 'mk') {
    const inMk = hasCyrillic(out.question) || hasCyrillic(out.answer);
    check('language_macedonian', inMk, inMk ? '' : 'Output does not appear to be in Macedonian (no Cyrillic detected)');
  }

  // Concept keyword presence
  const keywords = criteria.conceptKeywords ?? [];
  if (keywords.length > 0) {
    const haystack = normalise(`${out.question ?? ''} ${out.answer ?? ''}`);
    const foundAny = keywords.some(kw => haystack.includes(normalise(kw)));
    check('concept_keywords', foundAny,
      foundAny ? '' : `None of the expected keywords found: ${keywords.join(', ')}`);
  }
}

function validateLessonIdeas(out, criteria, check) {
  const activities = out.activities ?? out.mainActivities ?? [];
  const minAct = criteria.minActivities ?? 0;
  const actCount = Array.isArray(activities) ? activities.length : 0;
  check('min_activities', actCount >= minAct,
    actCount >= minAct ? '' : `Expected >= ${minAct} activities, got ${actCount}`);

  if (criteria.hasLearningObjectives) {
    const hasObj = !!(out.objectives ?? out.learningObjectives ?? out.goals);
    check('has_objectives', hasObj, hasObj ? '' : 'No learning objectives found in output');
  }

  const minLen = Number(criteria.minTotalLengthChars ?? 0);
  if (minLen > 0) {
    const totalText = JSON.stringify(out).length;
    check('output_length', totalText >= minLen,
      totalText >= minLen ? '' : `Output JSON too short: ${totalText} < ${minLen} chars`);
  }

  if (criteria.languageCode === 'mk') {
    const text = JSON.stringify(out);
    const inMk = hasCyrillic(text);
    check('language_macedonian', inMk, inMk ? '' : 'Output does not appear to be in Macedonian');
  }
}

function validateStepByStep(out, criteria, check) {
  const steps = out.steps ?? [];
  const stepCount = Array.isArray(steps) ? steps.length : 0;
  const minSteps = criteria.minSteps ?? 2;
  const maxSteps = criteria.maxSteps ?? 99;
  check('min_steps', stepCount >= minSteps,
    stepCount >= minSteps ? '' : `Expected >= ${minSteps} steps, got ${stepCount}`);
  check('max_steps', stepCount <= maxSteps,
    stepCount <= maxSteps ? '' : `Too many steps: ${stepCount} > ${maxSteps}`);

  if (criteria.hasAnswer) {
    const lastStep = steps[steps.length - 1];
    const lastText = lastStep?.explanation ?? lastStep?.text ?? '';
    const hasAns = lastText.length > 0 || !!out.answer;
    check('has_final_answer', hasAns, hasAns ? '' : 'Last step has no explanation/answer');
  }

  if (criteria.hasMathExpressions) {
    const allText = JSON.stringify(out);
    const hasMath = /[\d+\-*/=^√∑∫πx²³]|\\frac|\\sqrt|LaTeX/.test(allText);
    check('has_math_expressions', hasMath, hasMath ? '' : 'No mathematical expressions detected in steps');
  }

  if (criteria.languageCode === 'mk') {
    const inMk = hasCyrillic(JSON.stringify(out));
    check('language_macedonian', inMk, inMk ? '' : 'Output does not appear to be in Macedonian');
  }
}

function validateParallelTest(out, criteria, check) {
  const groups = out.groups ?? [];
  const groupCount = Array.isArray(groups) ? groups.length : 0;
  const minGroups = criteria.minGroups ?? 2;
  check('min_groups', groupCount >= minGroups,
    groupCount >= minGroups ? '' : `Expected >= ${minGroups} test groups (A/B), got ${groupCount}`);

  const totalQ = groups.reduce((acc, g) => acc + (Array.isArray(g.questions) ? g.questions.length : 0), 0);
  const minQ = criteria.totalQuestionsMin ?? 0;
  check('total_questions', totalQ >= minQ,
    totalQ >= minQ ? '' : `Expected >= ${minQ} total questions, got ${totalQ}`);

  if (criteria.hasAnswerKey) {
    const hasKey = groups.some(g => g.questions?.some(q => q.answer !== undefined));
    check('has_answer_key', hasKey, hasKey ? '' : 'No answer keys found in test groups');
  }

  if (criteria.languageCode === 'mk') {
    const inMk = hasCyrillic(JSON.stringify(out));
    check('language_macedonian', inMk, inMk ? '' : 'Output does not appear to be in Macedonian');
  }
}

function validateRubric(out, criteria, check) {
  const cr = out.criteria ?? out.rubricCriteria ?? [];
  const lvl = out.levels ?? out.rubricLevels ?? [];
  const minCr = criteria.minCriteria ?? 3;
  const minLvl = criteria.minLevels ?? 3;
  check('min_criteria', (Array.isArray(cr) ? cr.length : 0) >= minCr,
    (Array.isArray(cr) ? cr.length : 0) >= minCr ? '' : `Expected >= ${minCr} criteria`);
  check('min_levels', (Array.isArray(lvl) ? lvl.length : 0) >= minLvl,
    (Array.isArray(lvl) ? lvl.length : 0) >= minLvl ? '' : `Expected >= ${minLvl} performance levels`);

  const minLen = criteria.minTotalLengthChars ?? 0;
  if (minLen > 0) {
    const totalLen = JSON.stringify(out).length;
    check('output_length', totalLen >= minLen,
      totalLen >= minLen ? '' : `Output JSON too short: ${totalLen} < ${minLen} chars`);
  }

  if (criteria.languageCode === 'mk') {
    const inMk = hasCyrillic(JSON.stringify(out));
    check('language_macedonian', inMk, inMk ? '' : 'Output does not appear to be in Macedonian');
  }
}

function validateAnnualPlan(out, criteria, check) {
  const topics = out.topics ?? [];
  const topicCount = Array.isArray(topics) ? topics.length : 0;
  const minTopics = criteria.minTopics ?? 8;
  check('min_topics', topicCount >= minTopics,
    topicCount >= minTopics ? '' : `Expected >= ${minTopics} topics, got ${topicCount}`);

  const minWeeks = criteria.totalWeeksMin ?? 30;
  const weeks = out.totalWeeks ?? topics.reduce((s, t) => s + (t.weeks ?? t.numberOfWeeks ?? 0), 0);
  check('total_weeks', weeks >= minWeeks,
    weeks >= minWeeks ? '' : `Expected >= ${minWeeks} total weeks, got ${weeks}`);

  if (criteria.languageCode === 'mk') {
    const inMk = hasCyrillic(JSON.stringify(out));
    check('language_macedonian', inMk, inMk ? '' : 'Output does not appear to be in Macedonian');
  }
}

function buildResult(caseId, type, checks) {
  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 100;
  return { caseId, type, score, passed, total, checks };
}

// ── score history (D2 trend tracking) ─────────────────────────────────────

function loadHistory(historyPath) {
  if (!existsSync(historyPath)) return { entries: [] };
  try {
    return JSON.parse(readFileSync(historyPath, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function appendHistory(historyPath, entry) {
  const history = loadHistory(historyPath);
  history.entries.push(entry);
  // Keep only the last MAX_HISTORY_ENTRIES to bound file size
  if (history.entries.length > MAX_HISTORY_ENTRIES) {
    history.entries = history.entries.slice(-MAX_HISTORY_ENTRIES);
  }
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

/**
 * Print a compact ASCII trend chart of the last N history entries.
 * Shows average score per run and highlights direction.
 */
function printTrend(historyPath, lastN = 20) {
  const history = loadHistory(historyPath);
  const entries = history.entries.slice(-lastN);
  if (entries.length === 0) {
    console.log('[eval] No history entries found. Run with --record-history to start tracking.');
    return;
  }

  console.log(`\n📈 Quality Score Trend (last ${entries.length} runs)\n`);
  console.log('  Date                     | Cases | Avg%  | Trend');
  console.log('  -------------------------|-------|-------|------');

  let prev = null;
  for (const e of entries) {
    const dir = prev === null ? ' ' : e.avgScore > prev ? '↑' : e.avgScore < prev ? '↓' : '=';
    const bar = '█'.repeat(Math.round(e.avgScore / 10));
    console.log(`  ${String(e.runAt ?? '').padEnd(24)} | ${String(e.casesEvaluated).padEnd(5)} | ${String(e.avgScore + '%').padEnd(5)} | ${dir} ${bar}`);
    prev = e.avgScore;
  }

  if (entries.length >= 2) {
    const first = entries[0].avgScore;
    const last = entries[entries.length - 1].avgScore;
    const delta = last - first;
    const direction = delta > 0 ? `+${delta}` : `${delta}`;
    console.log(`\n  Change over tracked period: ${direction}% (${first}% → ${last}%)\n`);
  }

  // GitHub Step Summary
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      '## AI Quality Score Trend',
      `| Run | Cases | Avg Score | Trend |`,
      `|---|---|---|---|`,
    ];
    let prevScore = null;
    for (const e of entries) {
      const dir = prevScore === null ? '—' : e.avgScore > prevScore ? '⬆️' : e.avgScore < prevScore ? '⬇️' : '➡️';
      lines.push(`| ${e.runAt ?? ''} | ${e.casesEvaluated} | ${e.avgScore}% | ${dir} |`);
      prevScore = e.avgScore;
    }
    if (entries.length >= 2) {
      const delta = entries[entries.length-1].avgScore - entries[0].avgScore;
      lines.push(`\n**Trend over ${entries.length} runs:** ${delta >= 0 ? '+' : ''}${delta}%`);
    }
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'), { flag: 'a' });
  }
}

// ── golden-set schema validation (D1 mode) ────────────────────────────────

function validateGoldenSetSchema(goldenSet) {
  const errors = [];
  const ids = new Set();

  const VALID_TYPES = ['assessment_question','lesson_ideas','step_by_step_solution','parallel_test','rubric','annual_plan'];
  const VALID_BLOOM = ['Remembering','Understanding','Applying','Analyzing','Evaluating','Creating'];
  const VALID_DOK = [1,2,3,4];

  for (const [i, c] of goldenSet.cases.entries()) {
    const prefix = `cases[${i}] (id=${c.id})`;
    if (!c.id) errors.push(`${prefix}: missing "id"`);
    if (ids.has(c.id)) errors.push(`${prefix}: duplicate id "${c.id}"`);
    ids.add(c.id);
    if (!VALID_TYPES.includes(c.type)) errors.push(`${prefix}: invalid type "${c.type}"`);
    if (!c.input) errors.push(`${prefix}: missing "input"`);
    if (!c.expectedCriteria) errors.push(`${prefix}: missing "expectedCriteria"`);
    if (!Array.isArray(c.tags) || c.tags.length === 0) errors.push(`${prefix}: missing or empty "tags"`);
    if (c.input?.language && c.input.language !== 'mk') errors.push(`${prefix}: unexpected language "${c.input.language}" (expected "mk")`);

    const ec = c.expectedCriteria ?? {};
    if (ec.bloomLevel && !VALID_BLOOM.includes(ec.bloomLevel)) {
      errors.push(`${prefix}: invalid bloomLevel "${ec.bloomLevel}"`);
    }
    if (ec.dokLevel !== undefined && !VALID_DOK.includes(ec.dokLevel)) {
      errors.push(`${prefix}: invalid dokLevel ${ec.dokLevel}`);
    }
    if (!Array.isArray(ec.requiredFields) || ec.requiredFields.length === 0) {
      errors.push(`${prefix}: expectedCriteria.requiredFields must be a non-empty array`);
    }
  }

  const claimed = goldenSet.totalCases;
  const actual = goldenSet.cases.length;
  if (claimed !== actual) {
    errors.push(`totalCases claims ${claimed} but found ${actual} cases`);
  }

  return errors;
}

// ── reporting ──────────────────────────────────────────────────────────────

function printReport(results, options = {}) {
  const { minScore = 0, failBelow = false, recordHistory = false, historyPath = SCORE_HISTORY_PATH_DEFAULT } = options;
  const total = results.length;
  const passing = results.filter(r => r.score >= 100).length;
  const avgScore = total > 0 ? Math.round(results.reduce((s, r) => s + r.score, 0) / total) : 0;
  const belowThreshold = results.filter(r => r.score < minScore);

  // Group by type
  const byType = {};
  for (const r of results) {
    byType[r.type] = byType[r.type] ?? { count: 0, totalScore: 0 };
    byType[r.type].count++;
    byType[r.type].totalScore += r.score;
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       AI GENERATION QUALITY EVALUATION REPORT           ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Cases evaluated : ${String(total).padEnd(38)}║`);
  console.log(`║  Perfect score   : ${String(`${passing}/${total}`).padEnd(38)}║`);
  console.log(`║  Average score   : ${String(`${avgScore}%`).padEnd(38)}║`);
  if (minScore > 0) {
    console.log(`║  Min-score gate  : ${String(`${minScore}% (${belowThreshold.length} below)`).padEnd(38)}║`);
  }
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Scores by type:                                         ║');
  for (const [type, stats] of Object.entries(byType)) {
    const avg = Math.round(stats.totalScore / stats.count);
    const line = `    ${type} (${stats.count} cases): ${avg}%`;
    console.log(`║  ${line.padEnd(56)}║`);
  }
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Print failures
  const failures = results.filter(r => r.score < 100);
  if (failures.length > 0) {
    console.log(`\n⚠  ${failures.length} case(s) with imperfect scores:\n`);
    for (const f of failures) {
      console.log(`  [${f.caseId}] (${f.type}) — score ${f.score}% (${f.passed}/${f.total} checks)`);
      for (const chk of f.checks.filter(c => !c.pass)) {
        console.log(`      ✗ ${chk.name}: ${chk.detail}`);
      }
    }
  } else {
    console.log('\n✓ All evaluated cases passed all checks.\n');
  }

  // GitHub Step Summary
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      '## AI Evaluation Quality Report',
      `| Metric | Value |`,
      `|---|---|`,
      `| Cases evaluated | ${total} |`,
      `| Perfect score (100%) | ${passing}/${total} |`,
      `| Average score | ${avgScore}% |`,
      '',
      '### Scores by type',
      '| Type | Cases | Avg Score |',
      '|---|---|---|',
      ...Object.entries(byType).map(([t, s]) => `| ${t} | ${s.count} | ${Math.round(s.totalScore / s.count)}% |`),
    ];
    if (failures.length > 0) {
      lines.push('', '### Failed checks', '| Case | Check | Detail |', '|---|---|---|');
      for (const f of failures.slice(0, 50)) {
        for (const chk of f.checks.filter(c => !c.pass)) {
          lines.push(`| ${f.caseId} | ${chk.name} | ${chk.detail} |`);
        }
      }
    }
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'), { flag: 'a' });
  }

  // Append to score history if requested
  if (recordHistory) {
    const byTypeScores = Object.fromEntries(
      Object.entries(byType).map(([t, s]) => [t, Math.round(s.totalScore / s.count)])
    );
    const entry = {
      runAt: new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z',
      casesEvaluated: total,
      avgScore,
      perfectCount: passing,
      belowThresholdCount: belowThreshold.length,
      byType: byTypeScores,
    };
    appendHistory(resolve(ROOT, historyPath), entry);
    console.log(`[eval] Score recorded to ${historyPath}: avgScore=${avgScore}%, cases=${total}`);
  }

  if (failBelow && belowThreshold.length > 0) {
    console.error(`\n✖ ${belowThreshold.length} case(s) scored below the threshold of ${minScore}%.`);
    process.exit(1);
  }
}

// ── main ──────────────────────────────────────────────────────────────────

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? (args[idx + 1] ?? null) : null;
}

const args = process.argv.slice(2);
const mode = {
  validateSchema: args.includes('--validate-schema'),
  outputsFile: getArg(args, '--outputs'),
  filterTag: getArg(args, '--filter-tag'),
  minScore: parseInt(getArg(args, '--min-score') ?? '0', 10),
  failBelow: args.includes('--fail-below'),
  onlyProvided: args.includes('--only-provided'),
  recordHistory: args.includes('--record-history'),
  historyPath: getArg(args, '--history-path') ?? SCORE_HISTORY_PATH_DEFAULT,
  showTrend: args.includes('--show-trend'),
};

if (!mode.validateSchema && !mode.outputsFile && !mode.showTrend) {
  console.error('Usage: node scripts/run-eval.mjs [--validate-schema] [--outputs <file>] [--filter-tag <tag>] [--min-score <n>] [--fail-below] [--only-provided] [--record-history] [--show-trend]');
  process.exit(1);
}

const goldenSet = loadJSON(GOLDEN_SET_PATH);

if (mode.showTrend) {
  printTrend(resolve(ROOT, mode.historyPath));
  process.exit(0);
}

if (mode.validateSchema) {
  console.log(`[eval] Validating golden-set schema (${goldenSet.cases.length} cases)...`);
  const errors = validateGoldenSetSchema(goldenSet);
  if (errors.length > 0) {
    console.error('\n✖ Golden set schema validation failed:\n');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log(`✓ Schema validation passed: ${goldenSet.cases.length} valid cases (${goldenSet.totalCases} declared).`);
  process.exit(0);
}

if (mode.outputsFile) {
  const outputsBatch = loadJSON(resolve(ROOT, mode.outputsFile));
  // outputsBatch format: [{ caseId: "case-001", output: { ...AI output... } }, ...]
  if (!Array.isArray(outputsBatch)) {
    console.error('[eval] Outputs file must be a JSON array of { caseId, output } objects.');
    process.exit(1);
  }

  let cases = goldenSet.cases;
  const outputMap = Object.fromEntries(outputsBatch.map(o => [o.caseId, o.output]));

  if (mode.onlyProvided) {
    cases = cases.filter(c => outputMap[c.id] !== undefined);
    console.log(`[eval] Only provided outputs mode: ${cases.length} mapped case(s)`);
    if (cases.length === 0) {
      console.error('[eval] --only-provided was set, but no provided caseId matched golden-set cases.');
      process.exit(1);
    }
  }

  if (mode.filterTag) {
    cases = cases.filter(c => c.tags?.includes(mode.filterTag));
    console.log(`[eval] Filtering by tag "${mode.filterTag}": ${cases.length} cases`);
  }

  const results = cases.map(c => validateOutput(c, outputMap[c.id]));

  printReport(results, {
    minScore: mode.minScore,
    failBelow: mode.failBelow,
    recordHistory: mode.recordHistory,
    historyPath: mode.historyPath,
  });
}

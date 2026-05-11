/**
 * S65 P4-A/B/C — Static SEO page generator
 *
 * Generates:
 *   public/concepts/{id}.html      — one page per curriculum concept (500+)
 *   public/matura/{key}.html       — one page per MK matura exam (19 exams)
 *   public/sitemap.xml             — comprehensive sitemap with all URLs
 *
 * Run:  npx tsx scripts/generate-seo-pages.ts
 * Hook: called automatically after `vite build` via "build" npm script.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'https://ai.mismath.net';
const SITE_NAME = 'MisMath AI';

// ── Dynamic imports of TypeScript grade data ───────────────────────────────

import { grade1Data } from '../data/grade1.js';
import { grade2Data } from '../data/grade2.js';
import { grade3Data } from '../data/grade3.js';
import { grade4Data } from '../data/grade4.js';
import { grade5Data } from '../data/grade5.js';
import { grade6Data } from '../data/grade6.js';
import { grade7Data } from '../data/grade7.js';
import { grade8Data } from '../data/grade8.js';
import { grade9Data } from '../data/grade9.js';
import { secondaryCurricula } from '../data/secondaryCurriculum.js';
import type { Grade, Topic, Concept } from '../types.js';

// ── Types ──────────────────────────────────────────────────────────────────

interface ConceptMeta {
  id: string;
  title: string;
  description: string;
  standards: string[];
  activities: string[];
  topicTitle: string;
  gradeTitle: string;
  gradeNum: string;
}

interface MaturaExamMeta {
  key: string;
  year: number;
  session: string;
  title: string;
  questionCount: number;
  totalPoints: number;
  questions: Array<{
    questionNumber: number;
    points: number;
    questionText: string;
    topic: string;
    questionType: string;
  }>;
}

// ── Collect all concepts from primary + secondary curricula ────────────────

function collectConcepts(): ConceptMeta[] {
  const result: ConceptMeta[] = [];

  const primaryGrades: Grade[] = [
    grade1Data, grade2Data, grade3Data, grade4Data, grade5Data,
    grade6Data, grade7Data, grade8Data, grade9Data,
  ];

  for (const grade of primaryGrades) {
    for (const topic of (grade.topics as Topic[])) {
      for (const concept of (topic.concepts as Concept[])) {
        result.push({
          id: concept.id,
          title: concept.title,
          description: concept.description ?? '',
          standards: (concept.assessmentStandards ?? []) as string[],
          activities: (concept.activities ?? []) as string[],
          topicTitle: topic.title,
          gradeTitle: grade.title,
          gradeNum: String(grade.level ?? ''),
        });
      }
    }
  }

  for (const module of secondaryCurricula) {
    for (const grade of module.curriculum.grades) {
      for (const topic of (grade.topics as Topic[])) {
        for (const concept of (topic.concepts as Concept[])) {
          result.push({
            id: concept.id,
            title: concept.title,
            description: concept.description ?? '',
            standards: (concept.assessmentStandards ?? []) as string[],
            activities: (concept.activities ?? []) as string[],
            topicTitle: topic.title,
            gradeTitle: grade.title,
            gradeNum: String(grade.level ?? ''),
          });
        }
      }
    }
  }

  return result;
}

// ── Load matura exam data ──────────────────────────────────────────────────

function loadMaturaExams(): MaturaExamMeta[] {
  const rawDir = path.join(ROOT, 'data', 'matura', 'raw');
  const result: MaturaExamMeta[] = [];

  for (const file of fs.readdirSync(rawDir).filter(f => f.endsWith('-mk.json'))) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
      const exam = data.exam;
      if (!exam) continue;
      result.push({
        key: exam.id,
        year: exam.year,
        session: exam.session,
        title: exam.title,
        questionCount: exam.questionCount ?? 0,
        totalPoints: exam.totalPoints ?? 0,
        questions: (data.questions ?? []).slice(0, 50).map((q: Record<string, unknown>) => ({
          questionNumber: q.questionNumber,
          points: q.points,
          questionText: String(q.questionText ?? '').replace(/\$[^$]*\$/g, '(формула)').slice(0, 300),
          topic: q.topic ?? '',
          questionType: q.questionType ?? '',
        })),
      });
    } catch {
      // skip malformed files
    }
  }

  return result.sort((a, b) => b.year - a.year || a.session.localeCompare(b.session));
}

// ── HTML generators ────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function conceptHtml(c: ConceptMeta): string {
  const canonicalUrl = `${BASE_URL}/concepts/${c.id}.html`;
  const appUrl = `${BASE_URL}/#/concept/${c.id}`;
  const metaDesc = esc(c.standards.slice(0, 2).join(' ').slice(0, 155));
  const schemaOrg = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.title,
    description: metaDesc,
    provider: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
    educationalLevel: `Одделение ${c.gradeNum}`,
    about: c.topicTitle,
    url: canonicalUrl,
  });

  const standardsHtml = c.standards.length
    ? `<ul>${c.standards.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`
    : '';
  const activitiesHtml = c.activities.length
    ? `<ul>${c.activities.slice(0, 5).map(a => `<li>${esc(a)}</li>`).join('')}</ul>`
    : '';

  return `<!DOCTYPE html>
<html lang="mk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.title)} — Математика ${c.gradeNum} одделение | ${SITE_NAME}</title>
<meta name="description" content="${metaDesc}">
<link rel="canonical" href="${canonicalUrl}">
<link rel="alternate" hreflang="mk" href="${canonicalUrl}">
<link rel="alternate" hreflang="x-default" href="${canonicalUrl}">
<meta property="og:title" content="${esc(c.title)} | ${SITE_NAME}">
<meta property="og:description" content="${metaDesc}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="robots" content="index,follow">
<script type="application/ld+json">${schemaOrg}</script>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:1.5rem 1rem;color:#1a1a2e}h1{color:#1d4ed8}h2{color:#374151;margin-top:1.5rem}ul{line-height:1.8}a{color:#2563eb}.badge{display:inline-block;background:#eff6ff;color:#1d4ed8;padding:.2rem .6rem;border-radius:.4rem;font-size:.85rem;margin-bottom:.5rem}.cta{margin-top:2rem;padding:1rem 1.5rem;background:#eff6ff;border-radius:.75rem;border:1px solid #bfdbfe}</style>
</head>
<body>
<nav><a href="${BASE_URL}/">${SITE_NAME}</a> › <a href="${BASE_URL}/#/explore">Наставна програма</a></nav>
<p class="badge">${esc(c.gradeTitle)} › ${esc(c.topicTitle)}</p>
<h1>${esc(c.title)}</h1>
${c.description ? `<p>${esc(c.description)}</p>` : ''}
${standardsHtml ? `<h2>Стандарди за оценување</h2>${standardsHtml}` : ''}
${activitiesHtml ? `<h2>Активности и методи</h2>${activitiesHtml}` : ''}
<div class="cta">
  <strong>🤖 Интерактивно учење</strong> — Вештачката интелигенција генерира квизови, објаснувања и вежби за овој концепт.<br>
  <a href="${appUrl}">Отвори во MisMath AI →</a>
</div>
</body>
</html>`;
}

function maturaHtml(e: MaturaExamMeta): string {
  const session = e.session === 'june' ? 'Јуни' : 'Август';
  const canonicalUrl = `${BASE_URL}/matura/${e.key}.html`;
  const appUrl = `${BASE_URL}/#/matura`;
  const metaDesc = esc(`Државен испит по математика (ДИМ) — ${e.title}. ${e.questionCount} прашања, ${e.totalPoints} поени. Вежбај со MisMath AI.`);
  const schemaOrg = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: e.title,
    description: metaDesc,
    educationalLevel: 'Гимназиско образование — XII одделение',
    provider: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
    url: canonicalUrl,
    dateCreated: `${e.year}-01-01`,
  });

  const questionsHtml = e.questions
    .map(q => `<li><strong>Пр. ${q.questionNumber}</strong> [${q.topic}] (${q.points} поени): ${esc(q.questionText)}…</li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="mk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(e.title)} — ДИМ Математика | ${SITE_NAME}</title>
<meta name="description" content="${metaDesc}">
<link rel="canonical" href="${canonicalUrl}">
<link rel="alternate" hreflang="mk" href="${canonicalUrl}">
<link rel="alternate" hreflang="x-default" href="${canonicalUrl}">
<meta property="og:title" content="${esc(e.title)} | ${SITE_NAME}">
<meta property="og:description" content="${metaDesc}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="robots" content="index,follow">
<script type="application/ld+json">${schemaOrg}</script>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:1.5rem 1rem;color:#1a1a2e}h1{color:#1d4ed8}h2{color:#374151;margin-top:1.5rem}ul{line-height:1.8}a{color:#2563eb}.badge{display:inline-block;background:#fef3c7;color:#92400e;padding:.2rem .6rem;border-radius:.4rem;font-size:.85rem;margin-bottom:.5rem}.meta-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem;margin:1rem 0}.meta-card{background:#f8fafc;padding:.75rem;border-radius:.5rem;border:1px solid #e2e8f0}.cta{margin-top:2rem;padding:1rem 1.5rem;background:#fef3c7;border-radius:.75rem;border:1px solid #fde68a}</style>
</head>
<body>
<nav><a href="${BASE_URL}/">${SITE_NAME}</a> › <a href="${BASE_URL}/#/matura">Матурски испити</a></nav>
<p class="badge">ДИМ — Државен испит по математика</p>
<h1>${esc(e.title)}</h1>
<div class="meta-grid">
  <div class="meta-card"><strong>Година</strong><br>${e.year}</div>
  <div class="meta-card"><strong>Сесија</strong><br>${session}</div>
  <div class="meta-card"><strong>Прашања</strong><br>${e.questionCount}</div>
  <div class="meta-card"><strong>Поени</strong><br>${e.totalPoints}</div>
</div>
<h2>Прашања (преглед)</h2>
<ul>${questionsHtml}</ul>
<div class="cta">
  <strong>🤖 Вежбај со AI</strong> — MisMath AI генерира персонализирани совети, објаснувања и симулирани испити.<br>
  <a href="${appUrl}">Вежбај матура со MisMath AI →</a>
</div>
</body>
</html>`;
}

// ── Sitemap generator ──────────────────────────────────────────────────────

function generateSitemap(concepts: ConceptMeta[], exams: MaturaExamMeta[]): string {
  const today = new Date().toISOString().slice(0, 10);

  const staticUrls = [
    { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'weekly' },
    { loc: `${BASE_URL}/#/generator`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#/matura-portal`, priority: '0.9', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#/explore`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#/assistant`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#/matura-practice`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#/matura`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#/national-library`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${BASE_URL}/#/data-viz`, priority: '0.7', changefreq: 'monthly' },
    { loc: `${BASE_URL}/#/academy`, priority: '0.7', changefreq: 'monthly' },
  ];

  const conceptUrls = concepts.map(c => ({
    loc: `${BASE_URL}/concepts/${c.id}.html`,
    priority: '0.6',
    changefreq: 'yearly',
  }));

  const maturaUrls = exams.map(e => ({
    loc: `${BASE_URL}/matura/${e.key}.html`,
    priority: '0.7',
    changefreq: 'yearly',
  }));

  const allUrls = [...staticUrls, ...conceptUrls, ...maturaUrls];

  const urlEntries = allUrls.map(u => `  <url>
    <loc>${esc(u.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
    <xhtml:link rel="alternate" hreflang="mk" href="${esc(u.loc)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(u.loc)}"/>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const conceptsDir = path.join(ROOT, 'public', 'concepts');
  const maturaDir = path.join(ROOT, 'public', 'matura');

  fs.mkdirSync(conceptsDir, { recursive: true });
  fs.mkdirSync(maturaDir, { recursive: true });

  console.log('📚 Collecting curriculum concepts…');
  const concepts = collectConcepts();
  console.log(`   → ${concepts.length} concepts found`);

  console.log('📝 Generating concept HTML pages…');
  let conceptCount = 0;
  for (const c of concepts) {
    fs.writeFileSync(path.join(conceptsDir, `${c.id}.html`), conceptHtml(c), 'utf8');
    conceptCount++;
  }
  console.log(`   → ${conceptCount} concept pages written to public/concepts/`);

  console.log('📖 Loading matura exam data…');
  const exams = loadMaturaExams();
  console.log(`   → ${exams.length} MK matura exams found`);

  console.log('🏛️ Generating matura HTML pages…');
  for (const e of exams) {
    fs.writeFileSync(path.join(maturaDir, `${e.key}.html`), maturaHtml(e), 'utf8');
  }
  console.log(`   → ${exams.length} matura pages written to public/matura/`);

  console.log('🗺️ Generating sitemap.xml…');
  const sitemapXml = generateSitemap(concepts, exams);
  fs.writeFileSync(path.join(ROOT, 'public', 'sitemap.xml'), sitemapXml, 'utf8');
  console.log(`   → sitemap.xml: ${concepts.length + exams.length + 10} URLs total`);

  console.log('✅ SEO pages generated successfully.');
}

main().catch(err => {
  console.error('SEO generation failed:', err);
  process.exit(1);
});

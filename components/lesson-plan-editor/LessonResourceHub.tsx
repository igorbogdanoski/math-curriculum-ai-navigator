/**
 * S96.1 — LessonResourceHub
 *
 * Sidebar panel showing all platform resources relevant to the current lesson:
 * BRO scenarios, Dugga tests, extracted tasks, and AI presentations.
 * Each resource type shows count + list + quick-action buttons.
 */

import React, { useState } from 'react';
import { useLessonResources } from '../../hooks/useLessonResources';
import { getAvgRating, type ScenarioBankEntry } from '../../services/firestoreService.scenarioBank';
import { rankScenarios } from '../../utils/smartRecommendations';
import type { DuggaTest } from '../../services/firestoreService.dugga';
import type { CachedMaterial } from '../../services/firestoreService.types';

interface Props {
  grade: number | null | undefined;
  topicId?: string | null;
  theme?: string | null;
  uid: string | null | undefined;
  onNavigate: (path: string) => void;
  onImportScenario?: (entry: ScenarioBankEntry) => void;
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  count,
  open,
  onToggle,
}: {
  icon: string;
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 px-1 hover:bg-slate-50 rounded transition-colors"
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span>{icon}</span>
        <span>{label}</span>
        {count > 0 && (
          <span className="bg-brand-primary/15 text-brand-primary text-xs font-bold px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </span>
      <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
    </button>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ label, cta, onCta }: { label: string; cta: string; onCta: () => void }) {
  return (
    <div className="py-2 px-2 text-center">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <button
        type="button"
        onClick={onCta}
        className="text-xs text-brand-primary underline hover:text-brand-dark"
      >
        {cta}
      </button>
    </div>
  );
}

// ── Scenario card ──────────────────────────────────────────────────────────────

function ScenarioCard({
  entry,
  onNavigate,
  onImport,
}: {
  entry: ScenarioBankEntry;
  onNavigate: (path: string) => void;
  onImport?: (e: ScenarioBankEntry) => void;
}) {
  const rating = getAvgRating(entry);
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1">
      <p className="text-xs font-semibold text-slate-800 line-clamp-2">{entry.title}</p>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {entry.verifiedByBRO && (
          <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
            ✓ БРО
          </span>
        )}
        {rating !== null && <span>★ {rating}</span>}
        <span className="text-slate-400">{entry.authorName}</span>
      </div>
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => onNavigate('/scenario-bank')}
          className="flex-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded py-1 transition-colors"
        >
          Прегледај
        </button>
        {onImport && (
          <button
            type="button"
            onClick={() => onImport(entry)}
            className="flex-1 text-xs bg-brand-primary hover:bg-brand-dark text-white rounded py-1 transition-colors font-medium"
          >
            Увези
          </button>
        )}
      </div>
    </div>
  );
}

// ── Dugga test card ────────────────────────────────────────────────────────────

function TestCard({
  test,
  onNavigate,
}: {
  test: DuggaTest;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1">
      <p className="text-xs font-semibold text-slate-800 line-clamp-1">{test.title}</p>
      <p className="text-xs text-slate-500">
        {test.questions.length} прашања · {test.estimatedMinutes} мин
      </p>
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => onNavigate(`/dugga?id=${test.id}`)}
          className="flex-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded py-1 transition-colors"
        >
          Отвори
        </button>
        <button
          type="button"
          onClick={() => onNavigate(`/live-session/new?testId=${test.id}`)}
          className="flex-1 text-xs bg-violet-500 hover:bg-violet-600 text-white rounded py-1 transition-colors"
        >
          ▶ Live
        </button>
      </div>
    </div>
  );
}

// ── Material card (extracted tasks / presentations) ────────────────────────────

function MaterialCard({
  material,
  onNavigate,
}: {
  material: CachedMaterial;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1">
      <p className="text-xs font-semibold text-slate-800 line-clamp-2">
        {material.title ?? 'Материјал'}
      </p>
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => onNavigate(`/content-library?id=${material.id}`)}
          className="flex-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded py-1 transition-colors"
        >
          Прегледај
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export const LessonResourceHub: React.FC<Props> = ({
  grade,
  topicId,
  theme,
  uid,
  onNavigate,
  onImportScenario,
}) => {
  const { scenarios, tests, extractedTasks, presentations, isLoading, error } =
    useLessonResources({ grade, topicId, theme, uid });

  // S100.4 — rank scenarios by smart score (community + rating + proximity)
  const rankedScenarios = grade
    ? rankScenarios(scenarios, grade, theme ? [theme] : [], scenarios.length)
        .map(r => r.entry)
    : scenarios;

  const [openScenarios, setOpenScenarios] = useState(true);
  const [openTests, setOpenTests] = useState(true);
  const [openTasks, setOpenTasks] = useState(false);
  const [openPresentations, setOpenPresentations] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-red-500 py-2">
        Не можам да ги вчитам ресурсите. Обиди се повторно.
      </p>
    );
  }

  const hasContent =
    scenarios.length + tests.length + extractedTasks.length + presentations.length > 0;

  if (!grade || !theme) {
    return (
      <p className="text-xs text-slate-400 py-3 text-center">
        Внеси одделение и тема за да видиш ресурси.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {!hasContent && (
        <p className="text-xs text-slate-400 text-center py-2">
          Нема ресурси за оваа тема. Создади нови со Quick-Launch копчињата подолу.
        </p>
      )}

      {/* Scenarios */}
      <div className="border-b border-slate-100 pb-1">
        <SectionHeader
          icon="🎯"
          label="Сценарија"
          count={scenarios.length}
          open={openScenarios}
          onToggle={() => setOpenScenarios(o => !o)}
        />
        {openScenarios && (
          <div className="space-y-2 mt-1">
            {scenarios.length === 0 ? (
              <EmptyState
                label="Нема сценарија за оваа тема"
                cta="Разгледај Банка на сценарија →"
                onCta={() => onNavigate('/scenario-bank')}
              />
            ) : (
              rankedScenarios.slice(0, 3).map(s => (
                <ScenarioCard
                  key={s.id}
                  entry={s}
                  onNavigate={onNavigate}
                  onImport={onImportScenario}
                />
              ))
            )}
            {scenarios.length > 3 && (
              <button
                type="button"
                onClick={() => onNavigate('/scenario-bank')}
                className="w-full text-xs text-brand-primary underline"
              >
                Прикажи сите {scenarios.length} сценарија →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dugga tests */}
      <div className="border-b border-slate-100 pb-1">
        <SectionHeader
          icon="📊"
          label="Dugga тестови"
          count={tests.length}
          open={openTests}
          onToggle={() => setOpenTests(o => !o)}
        />
        {openTests && (
          <div className="space-y-2 mt-1">
            {tests.length === 0 ? (
              <EmptyState
                label="Нема тестови за оваа тема"
                cta="Создади Dugga тест →"
                onCta={() =>
                  onNavigate(
                    `/dugga/new?prefillTopic=${encodeURIComponent(theme ?? '')}&prefillGrade=${grade}`,
                  )
                }
              />
            ) : (
              tests.slice(0, 3).map(t => (
                <TestCard key={t.id} test={t} onNavigate={onNavigate} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Extracted tasks */}
      <div className="border-b border-slate-100 pb-1">
        <SectionHeader
          icon="📄"
          label="Извлечени задачи"
          count={extractedTasks.length}
          open={openTasks}
          onToggle={() => setOpenTasks(o => !o)}
        />
        {openTasks && (
          <div className="space-y-2 mt-1">
            {extractedTasks.length === 0 ? (
              <EmptyState
                label="Нема извлечени задачи"
                cta="Извлечи задачи (PDF/веб) →"
                onCta={() => onNavigate('/extraction-hub')}
              />
            ) : (
              extractedTasks.slice(0, 3).map(m => (
                <MaterialCard key={m.id} material={m} onNavigate={onNavigate} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Presentations */}
      <div className="pb-1">
        <SectionHeader
          icon="🎬"
          label="Презентации"
          count={presentations.length}
          open={openPresentations}
          onToggle={() => setOpenPresentations(o => !o)}
        />
        {openPresentations && (
          <div className="space-y-2 mt-1">
            {presentations.length === 0 ? (
              <EmptyState
                label="Нема презентации за оваа тема"
                cta="Генерирај Gamma презентација →"
                onCta={() => onNavigate('/gamma')}
              />
            ) : (
              presentations.slice(0, 3).map(m => (
                <MaterialCard key={m.id} material={m} onNavigate={onNavigate} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import type { User } from 'firebase/auth';
import type { LessonPlan } from '../../types';
import type { ScenarioBankEntry } from '../../services/firestoreService.scenarioBank';
import type { MathToolTab } from '../common/MathToolsPanel';
import type { useLessonPlanAIActions } from './useLessonPlanAIActions';
import { Card } from '../common/Card';
import { VerticalProgressionPanel } from './VerticalProgressionPanel';
import { PriorKnowledgeConnector } from './PriorKnowledgeConnector';
import { ClassInsightsBanner } from '../classroom/ClassInsightsBanner';
import { PedagogicalDashboard } from './PedagogicalDashboard';
import { AILessonAssistant } from './AILessonAssistant';
import { LessonPlanDifferentiationPanel } from './LessonPlanDifferentiationPanel';
import { RichTaskPanel } from './RichTaskPanel';
import { PedagogicalEnrichPanel } from '../planner/PedagogicalEnrichPanel';
import { CulturalResponsivenessPanel } from './CulturalResponsivenessPanel';
import { PedagogicalModelsPanel } from './PedagogicalModelsPanel';
import { StudentCognitiveProfilePanel } from './StudentCognitiveProfilePanel';
import { ContextualMathTools } from './ContextualMathTools';
import { LessonResourceHub } from './LessonResourceHub';
import { detectMathDomain } from '../../utils/mathDomainDetector';

interface LessonPlanSidebarProps {
  plan: Partial<LessonPlan>;
  ai: ReturnType<typeof useLessonPlanAIActions>;
  setPlan: React.Dispatch<React.SetStateAction<Partial<LessonPlan>>>;
  firebaseUser: User | null;
  navigate: (path: string) => void;
  onOpenMathTools: (tab: MathToolTab) => void;
  onImportScenario: (entry: ScenarioBankEntry) => void;
}

export const LessonPlanSidebar: React.FC<LessonPlanSidebarProps> = ({
  plan, ai, setPlan, firebaseUser, navigate, onOpenMathTools, onImportScenario,
}) => {
  return (
    <aside className="w-full lg:w-80 space-y-4">
      <VerticalProgressionPanel
        topicTitle={plan.theme || plan.title || ''}
        gradeLevel={plan.grade ?? 6}
      />

      <PriorKnowledgeConnector
        conceptIds={plan.conceptIds ?? []}
        currentGrade={plan.grade ?? 6}
      />

      <ClassInsightsBanner
        conceptIds={plan.conceptIds ?? []}
        teacherUid={firebaseUser?.uid}
        onOpenLab={(conceptId) => {
          const base = `${window.location.origin}${window.location.pathname}`;
          window.open(`${base}#/data-viz?lab=${conceptId}&tab=exercises`, '_blank');
        }}
      />

      <PedagogicalDashboard activities={plan.scenario?.main || []} />

      <AILessonAssistant
        onApply={(suggestion) => {
          setPlan(prev => ({
            ...prev,
            differentiation: prev.differentiation
              ? `${prev.differentiation}\n\n--- AI Assistant ---\n${suggestion}`
              : suggestion,
          }));
        }}
      />

      <LessonPlanDifferentiationPanel
        diffActivities={ai.diffActivities}
        isGenerating={ai.isGeneratingDiff}
        canGenerate={!!(plan.title || plan.theme)}
        onGenerate={ai.handleGenerateDifferentiation}
      />

      <RichTaskPanel
        richTask={ai.richTask}
        isGenerating={ai.isGeneratingRichTask}
        canGenerate={!!(plan.title || plan.theme)}
        onGenerate={ai.handleGenerateRichTask}
      />

      <PedagogicalEnrichPanel
        planType="lesson"
        planSummary={{
          grade: String(plan.grade ?? ''),
          title: plan.title,
          objectives: plan.objectives?.map(o => o.text),
          activities: [
            ...(plan.scenario?.main?.map(m => m.text) ?? []),
            plan.scenario?.introductory?.text ?? '',
          ].filter(Boolean),
        }}
      />

      <CulturalResponsivenessPanel plan={plan} />

      <PedagogicalModelsPanel />

      {/* S99.3 — Student Cognitive Profile */}
      {firebaseUser?.uid && plan.grade && (
        <StudentCognitiveProfilePanel
          grade={plan.grade}
          teacherUid={firebaseUser.uid}
        />
      )}

      {/* S97.1 — Contextual Math Tools */}
      {(plan.theme || plan.title) && (
        <ContextualMathTools
          topicTitle={plan.theme || plan.title}
          onNavigate={(path) => {
            const tabMatch = path.match(/\/math-tools\?tab=(.+)/);
            if (tabMatch) {
              onOpenMathTools(tabMatch[1] as MathToolTab);
            } else {
              navigate(path);
            }
          }}
        />
      )}

      {/* S96.1 — Resource Hub */}
      <Card className="p-3">
        <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <span>📚</span> Ресурси за оваа тема
        </h3>
        <LessonResourceHub
          grade={plan.grade}
          topicId={plan.topicId}
          theme={plan.theme || plan.title}
          uid={firebaseUser?.uid}
          onNavigate={navigate}
          onImportScenario={onImportScenario}
        />
      </Card>

      {/* S96.4 — Quick-Launch */}
      {(plan.title || plan.theme) && plan.grade && (
        <Card className="p-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Брзо создади
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {detectMathDomain(plan.theme || plan.title || '') === 'algebra' && (
              <button
                type="button"
                onClick={() => onOpenMathTools('algebra-tiles')}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-200"
              >
                <span>🔲</span> Алгебарски Плочки за оваа тема
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(`/dugga/build?topic=${encodeURIComponent(plan.theme || plan.title || '')}&grade=${plan.grade}`)}
              className="flex items-center gap-2 px-3 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-medium transition-colors border border-violet-200"
            >
              <span>📊</span> Dugga тест за оваа тема
            </button>
            <button
              type="button"
              onClick={() => navigate(`/kahoot/make?prefillTopic=${encodeURIComponent(plan.theme || plan.title || '')}&prefillGrade=${plan.grade}`)}
              className="flex items-center gap-2 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-medium transition-colors border border-rose-200"
            >
              <span>🎮</span> Kahoot за оваа тема
            </button>
            <button
              type="button"
              onClick={() => navigate(`/gamma?prefillTopic=${encodeURIComponent(plan.theme || plan.title || '')}&prefillGrade=${plan.grade}`)}
              className="flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-medium transition-colors border border-amber-200"
            >
              <span>🎬</span> Gamma презентација
            </button>
            <button
              type="button"
              onClick={() => navigate('/extraction-hub')}
              className="flex items-center gap-2 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-medium transition-colors border border-sky-200"
            >
              <span>📄</span> Извлечи задачи (PDF/веб)
            </button>
          </div>
        </Card>
      )}
    </aside>
  );
};

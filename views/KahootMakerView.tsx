/**
 * KahootMakerView — S51 upgrade
 * Three creation paths: Extraction Hub tasks / document upload / free-text prompt
 * AI generates proper MC questions; teacher can edit every question before launch.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Gamepad2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { firestoreService } from '../services/firestoreService';
import { saveKahootToBank } from '../services/firestoreService.scenarioBank';
import { geminiService } from '../services/geminiService';
import { useCurriculum } from '../hooks/useCurriculum';
import type { KahootQuestion } from '../services/geminiService';
import type { EnrichedWebTask } from '../services/gemini/visionContracts';
import { SourceStep } from '../components/kahoot/SourceStep';
import { EditingStep } from '../components/kahoot/EditingStep';
import { SESSION_KEY, AUTO_LAUNCH_KEY, readFileAsBase64, makeBlankQuestion, type Step, type Source } from '../components/kahoot/kahootConstants';

// ─── Main view ────────────────────────────────────────────────────────────────

interface KahootMakerViewProps {
  prefillTopic?: string;
  prefillGrade?: string;
}

export const KahootMakerView: React.FC<KahootMakerViewProps> = ({ prefillTopic, prefillGrade }) => {
  const { firebaseUser } = useAuth();
  const { navigate } = useNavigation();
  const { curriculum } = useCurriculum();

  // Workflow state
  const [step, setStep] = useState<Step>('source');
  const [activeSource, setActiveSource] = useState<Source | null>(null);

  // Source data
  const [sessionTasks, setSessionTasks] = useState<EnrichedWebTask[]>([]);
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<Set<number>>(new Set());
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docCount, setDocCount] = useState(8);
  const [promptText, setPromptText] = useState(prefillTopic ?? '');
  const [promptCount, setPromptCount] = useState(6);

  // Curriculum context for prompt path — pre-fill from URL params when coming from lesson plan
  const [promptGradeId, setPromptGradeId] = useState('');
  const [promptTopicId, setPromptTopicId] = useState('');

  // Resolve prefillGrade (number string) to grade id once curriculum is loaded
  useEffect(() => {
    if (prefillGrade && curriculum && !promptGradeId) {
      const gradeNum = Number(prefillGrade);
      const found = curriculum.grades.find(g => g.level === gradeNum);
      if (found) setPromptGradeId(found.id);
    }
  }, [prefillGrade, curriculum, promptGradeId]);
  const promptGrade = useMemo(
    () => curriculum?.grades.find(g => g.id === promptGradeId),
    [curriculum, promptGradeId],
  );
  const promptTopics = promptGrade?.topics ?? [];
  const promptTopicObj = useMemo(
    () => promptTopics.find(t => t.id === promptTopicId),
    [promptTopics, promptTopicId],
  );

  // Editor state
  const [questions, setQuestions] = useState<KahootQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Config state
  const [timerSeconds, setTimerSeconds] = useState<number | undefined>(20);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load session tasks + Gamma quick-launch on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed: EnrichedWebTask[] = JSON.parse(raw);
        setSessionTasks(parsed);
        setSelectedTaskIndices(new Set(parsed.map((_, i) => i)));
      }
    } catch { /* corrupted — ignore */ }

    try {
      const gammaRaw = sessionStorage.getItem('kahoot_gamma_prompt');
      if (gammaRaw) {
        const { prompt, count } = JSON.parse(gammaRaw) as { prompt: string; count: number };
        sessionStorage.removeItem('kahoot_gamma_prompt');
        setActiveSource('prompt');
        setPromptText(prompt);
        setPromptCount(count);
      }
    } catch { /* corrupted — ignore */ }
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const updateQuestion = (idx: number, q: KahootQuestion) =>
    setQuestions(prev => prev.map((old, i) => i === idx ? q : old));

  const deleteQuestion = (idx: number) =>
    setQuestions(prev => prev.filter((_, i) => i !== idx));

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setQuestions(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const addBlankQuestion = () =>
    setQuestions(prev => [...prev, makeBlankQuestion()]);

  const toggleTaskIndex = (i: number) =>
    setSelectedTaskIndices(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  // ── Generation ────────────────────────────────────────────────────────────

  const generate = async () => {
    setGenError(null);
    setGenerating(true);
    setStep('generating');
    try {
      let qs: KahootQuestion[] = [];
      if (activeSource === 'tasks') {
        const chosen = sessionTasks.filter((_, i) => selectedTaskIndices.has(i));
        qs = await geminiService.generateKahootFromTasks(chosen);
        if (!title) setTitle(`Kahoot — ${new Date().toLocaleDateString('mk-MK')}`);
      } else if (activeSource === 'document' && docFile) {
        const { base64, mimeType } = await readFileAsBase64(docFile);
        qs = await geminiService.generateKahootFromDocument(base64, mimeType, docCount);
        if (!title) setTitle(`Kahoot — ${docFile.name.replace(/\.[^.]+$/, '')}`);
      } else if (activeSource === 'prompt' && promptText.trim()) {
        let enriched = promptText.trim();
        if (promptGrade) {
          enriched += `\n\n[Наставна програма: ${promptGrade.title}`;
          if (promptTopicObj) {
            enriched += ` — ${promptTopicObj.title}`;
            const standards = promptTopicObj.concepts
              .flatMap(c => c.assessmentStandards ?? [])
              .slice(0, 6);
            if (standards.length > 0) {
              enriched += `\nСтандарди: ${standards.join('; ')}`;
            }
          }
          enriched += ']';
        }
        qs = await geminiService.generateKahootFromPrompt(enriched, promptCount);
        if (!title) setTitle(`Kahoot — ${promptText.trim().slice(0, 40)}`);
      }
      if (qs.length === 0) throw new Error('AI не врати ниту едно прашање. Обиди се со поинаков опис.');
      setQuestions(qs);
      setStep('editing');
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Грешка при генерирање.');
      setStep('source');
    } finally {
      setGenerating(false);
    }
  };

  // ── Save & launch ─────────────────────────────────────────────────────────

  const handleLaunch = async () => {
    if (!firebaseUser || questions.length === 0) return;
    const valid = questions.filter(q => q.question.trim() && q.options.every((o: string) => o.trim()));
    if (valid.length === 0) {
      setSaveError('Нема комплетирани прашања. Пополни ги полиња за прашање и сите 4 одговори.');
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const quizContent = {
        title: title.trim() || 'Kahoot квиз',
        questions: valid.map(q => ({
          question: q.question.trim(),
          type: 'multiple_choice',
          options: q.options,
          answer: q.options[q.correctIndex],
          difficulty_level: q.difficulty,
          ...(q.dokLevel ? { dok_level: q.dokLevel } : {}),
        })),
      };
      const quizId = await firestoreService.saveToCachedMaterials(quizContent, {
        title: quizContent.title,
        type: 'quiz',
        teacherUid: firebaseUser.uid,
      });
      // Mirror to scenario_bank (national bank, public by default)
      saveKahootToBank({
        title: quizContent.title,
        grade: Number(promptGrade?.level ?? 0),
        topicTitle: promptTopicObj?.title ?? '',
        questionCount: valid.length,
        authorUid: firebaseUser.uid,
        authorName: firebaseUser.displayName ?? 'Наставник',
        isPublic: true,
      }).catch(() => { /* non-critical */ });
      const autoLaunch = { quizId, quizTitle: quizContent.title, timerPerQuestion: timerSeconds };
      try { sessionStorage.setItem(AUTO_LAUNCH_KEY, JSON.stringify(autoLaunch)); } catch { /* quota */ }
      navigate('/live/host');
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Грешка при зачувување.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * "Kahoot Maker" only ever launched into this app's OWN Live Class before this —
   * despite the name, it never produced anything a teacher could import into real
   * kahoot.com. This exports a .xlsx matching kahoot.com's own "Import from
   * spreadsheet" column format.
   */
  const handleExportKahootXlsx = async () => {
    const valid = questions.filter(q => q.question.trim() && q.options.every((o: string) => o.trim()));
    if (valid.length === 0) return;
    const { exportKahootXlsx } = await import('../utils/exportKahootXlsx');
    await exportKahootXlsx(title.trim() || 'Kahoot квиз', valid, timerSeconds);
  };


  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'generating') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 p-8">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-indigo-100" />
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
          <Gamepad2 className="absolute inset-0 m-auto w-8 h-8 text-indigo-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-gray-800">AI генерира прашања...</p>
          <p className="text-sm text-gray-500 mt-1">Создава дистрактори, ги проверува одговорите</p>
        </div>
      </div>
    );
  }

  if (step === 'editing') {
    return (
      <EditingStep
        questions={questions}
        title={title}
        onTitleChange={setTitle}
        timerSeconds={timerSeconds}
        onTimerChange={setTimerSeconds}
        saveError={saveError}
        saving={saving}
        canLaunch={!!firebaseUser}
        onBackToSource={() => setStep('source')}
        onLaunch={handleLaunch}
        onExportXlsx={handleExportKahootXlsx}
        onUpdateQuestion={updateQuestion}
        onDeleteQuestion={deleteQuestion}
        onMoveQuestion={moveQuestion}
        onAddBlankQuestion={addBlankQuestion}
      />
    );
  }

  return (
    <SourceStep
      onBack={() => navigate('/live/host')}
      genError={genError}
      activeSource={activeSource}
      onSetActiveSource={setActiveSource}
      sessionTasks={sessionTasks}
      selectedTaskIndices={selectedTaskIndices}
      onToggleTaskIndex={toggleTaskIndex}
      onSelectAllTasks={(allSelected, total) =>
        setSelectedTaskIndices(allSelected ? new Set() : new Set(Array.from({ length: total }, (_, i) => i)))
      }
      docFile={docFile}
      onDocFileChange={setDocFile}
      docCount={docCount}
      onDocCountChange={setDocCount}
      fileInputRef={fileInputRef}
      promptText={promptText}
      onPromptTextChange={setPromptText}
      promptCount={promptCount}
      onPromptCountChange={setPromptCount}
      curriculum={curriculum}
      promptGradeId={promptGradeId}
      onPromptGradeIdChange={setPromptGradeId}
      promptTopicId={promptTopicId}
      onPromptTopicIdChange={setPromptTopicId}
      promptGrade={promptGrade}
      promptTopics={promptTopics}
      promptTopicObj={promptTopicObj}
      generating={generating}
      onGenerate={generate}
    />
  );
};

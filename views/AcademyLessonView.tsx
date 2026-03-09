import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, BrainCircuit, CheckCircle2, PenLine, Rocket, Save, Target, Wand2 } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { ACADEMY_CONTENT } from '../data/academy/content';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { GeneratorState } from '../hooks/useGeneratorState';
import { useAcademyProgress } from '../contexts/AcademyProgressContext';

export const AcademyLessonView: React.FC<{ id: string }> = ({ id }) => {
  const { navigate } = useNavigation();
  const { openGeneratorPanel } = useGeneratorPanel();
  const { progress, markLessonAsRead, markLessonAsApplied, saveReflection } = useAcademyProgress();

  const lesson = ACADEMY_CONTENT[id];
  const isApplied = progress.appliedLessons.includes(id);
  const existingReflection = progress.reflections[id] ?? '';

  const [reflectionNote, setReflectionNote] = useState(existingReflection);
  const [isSaved, setIsSaved] = useState(false);

  // Sync textarea if reflection loads from Firestore after mount
  useEffect(() => {
    setReflectionNote(progress.reflections[id] ?? '');
    setIsSaved(false);
  }, [id, progress.reflections]);

  useEffect(() => {
    if (lesson) {
      markLessonAsRead(id);
    }
  }, [id, lesson, markLessonAsRead]);

  if (!lesson) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <BookOpen className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Лекцијата не е пронајдена</h2>
        <p className="text-gray-500 mb-6 max-w-md">Модулот што го барате моментално е во подготовка или е преместен.</p>
        <button
          type="button"
          onClick={() => navigate('/academy')}
          className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors"
        >
          Врати се назад
        </button>
      </div>
    );
  }

  const handleTryItOut = () => {
    markLessonAsApplied(id);
    const statePayload: Partial<GeneratorState> = {};
    if (lesson.type === 'model') {
      statePayload.learningDesignModel = lesson.generatorKey;
    } else if (lesson.type === 'tone') {
      statePayload.scenarioTone = lesson.generatorKey;
    } else if (lesson.type === 'focus') {
      statePayload.activityFocus = lesson.generatorKey;
    }
    openGeneratorPanel(statePayload);
  };

  const handleSaveReflection = () => {
    if (!reflectionNote.trim()) return;
    saveReflection(id, reflectionNote.trim());
    setIsSaved(true);
  };

  const getCategoryName = () => {
    switch (lesson.type) {
      case 'model': return 'Педагошки модел';
      case 'tone': return 'Тон на сценариото';
      case 'focus': return 'Фокус на активноста';
      default: return 'Лекција';
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

      {/* Header Navigation */}
      <div className="border-b bg-white top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/academy')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Назад во Едукативен Центар</span>
          </button>

          <button
            onClick={handleTryItOut}
            className="hidden sm:flex px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg items-center gap-2 font-medium transition-colors border border-indigo-200"
          >
            <Wand2 className="w-4 h-4" />
            {isApplied ? 'Генерирај уште еднаш' : 'Генерирај час со овој пристап'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10">

        {/* Title Section */}
        <div className="mb-12 text-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{getCategoryName()}</span>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mt-4 mb-6 leading-tight">
            {lesson.title}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {lesson.theory[0]}
          </p>
        </div>

        {/* Content Body */}
        <div className="grid gap-8">

          {/* Theory */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Што претставува ова?</h2>
            </div>
            <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
              {lesson.theory.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Math Example */}
          <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold">Пример за {lesson.title}</h2>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20">
                <p className="text-lg leading-relaxed">{lesson.mathExample}</p>
              </div>
            </div>
          </div>

          {/* Cognitive Benefit */}
          <div className="bg-amber-50 p-8 rounded-2xl shadow-sm border border-amber-100 flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-shrink-0 w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
              <BrainCircuit className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-amber-900 mb-2">Зошто работи одлично?</h3>
              <p className="text-amber-800/80 text-lg leading-relaxed">
                {lesson.cognitiveBenefit}
              </p>
            </div>
          </div>

          {/* CTA — transforms after lesson is applied */}
          {!isApplied ? (
            <div className="mt-8 mb-4 flex flex-col items-center p-12 bg-gray-50 border border-gray-200 rounded-3xl text-center">
              <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mb-6">
                <Rocket className="w-8 h-8 text-brand-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Подготвени сте да го пробате?</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-8">
                Видовте како изгледа во теорија. Сега е време да пуштите вештачката интелигенција да ви генерира вистински час базиран на овие принципи.
              </p>
              <button
                type="button"
                onClick={handleTryItOut}
                className="px-8 py-4 bg-brand-primary text-white rounded-xl font-bold text-lg hover:bg-brand-secondary hover:shadow-lg transition-all flex items-center gap-3 transform hover:-translate-y-1"
              >
                <Wand2 className="w-6 h-6" />
                Генерирај час за твојата паралелка
              </button>
            </div>
          ) : (
            /* Applied state — show generate again + reflection panel */
            <div className="grid gap-6 mt-4 mb-4">

              {/* Generate again strip */}
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-6 py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <span className="font-semibold text-green-800">Го применивте овој пристап!</span>
                </div>
                <button
                  onClick={handleTryItOut}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors"
                >
                  <Wand2 className="w-4 h-4" />
                  Генерирај уште еднаш
                </button>
              </div>

              {/* Reflection Journal Panel */}
              <div className="bg-white border-2 border-indigo-100 rounded-2xl p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <PenLine className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Рефлексивен Дневник</h3>
                    <p className="text-sm text-gray-500">Donald Schön: „Учиме преку рефлексија на сопственото предавање."</p>
                  </div>
                </div>

                <p className="text-gray-600 mt-4 mb-5 leading-relaxed">
                  Откако ќе го одржите часот со овој пристап — запишете неколку реченици. Дали фазите функционираа? Каде учениците заглавија? Што би смениле следниот пат?
                </p>

                <textarea
                  value={reflectionNote}
                  onChange={e => { setReflectionNote(e.target.value); setIsSaved(false); }}
                  placeholder="Пр: Фазата Explore беше одлична — учениците ги мереа реалните триаголници и самите ја открија врската. Следниот пат би дале повеќе време за фазата Elaborate..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-700 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
                />

                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-gray-400">
                    {reflectionNote.length > 0
                      ? `${reflectionNote.length} знаци`
                      : 'Опционално — рефлексијата е само за вас'}
                  </span>
                  <button
                    type="button"
                  onClick={handleSaveReflection}
                    disabled={!reflectionNote.trim() || isSaved}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isSaved
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    {isSaved
                      ? <><CheckCircle2 className="w-4 h-4" /> Зачувано</>
                      : <><Save className="w-4 h-4" /> Зачувај рефлексија</>
                    }
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

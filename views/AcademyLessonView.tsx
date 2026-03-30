import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, BrainCircuit, Rocket, Target, Wand2, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { ACADEMY_CONTENT } from '../data/academy/content';
import type { DokClassifyItem } from '../data/academy/content';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { GeneratorState } from '../hooks/useGeneratorState';
import { AcademyMentor } from '../components/academy/AcademyMentor';
import { AcademyQuiz } from '../components/academy/AcademyQuiz';
import { useAcademyProgress } from '../contexts/AcademyProgressContext';
import { DokBadge } from '../components/common/DokBadge';
import { DOK_META } from '../types';
import type { DokLevel } from '../types';

const AlgebraTilesCanvas = React.lazy(() =>
  import('../components/math/AlgebraTilesCanvas').then(m => ({ default: m.AlgebraTilesCanvas }))
);
const Shape3DViewer = React.lazy(() =>
  import('../components/math/Shape3DViewer').then(m => ({ default: m.Shape3DViewer }))
);

/** DoK classification exercise — teacher picks DoK level for each item */
const DokClassifier: React.FC<{ items: DokClassifyItem[] }> = ({ items }) => {
  const [answers, setAnswers] = useState<Record<number, DokLevel>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const handlePick = (idx: number, lvl: DokLevel) => {
    if (revealed[idx]) return;
    setAnswers(a => ({ ...a, [idx]: lvl }));
    setRevealed(r => ({ ...r, [idx]: true }));
  };

  const score = items.filter((item, i) => answers[i] === item.correctDok).length;
  const allDone = Object.keys(revealed).length === items.length;

  return (
    <div className="bg-indigo-950 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-indigo-300 font-black text-sm uppercase tracking-widest">Вежба: Класифицирај по DoK ниво</p>
        {allDone && (
          <span className={`px-3 py-1 rounded-full text-sm font-black ${score >= 6 ? 'bg-green-500 text-white' : score >= 4 ? 'bg-amber-400 text-amber-900' : 'bg-red-500 text-white'}`}>
            {score}/{items.length} точни
          </span>
        )}
      </div>
      <div className="space-y-3">
        {items.map((item, idx) => {
          const chosen = answers[idx];
          const done = revealed[idx];
          const correct = chosen === item.correctDok;
          return (
            <div key={idx} className={`rounded-xl p-4 border transition-colors ${done ? (correct ? 'border-green-500 bg-green-900/30' : 'border-red-500 bg-red-900/20') : 'border-indigo-700 bg-indigo-900/40'}`}>
              <p className="text-white text-sm font-medium mb-3 leading-snug">{idx + 1}. {item.question}</p>
              <div className="flex flex-wrap gap-2 items-center">
                {([1, 2, 3, 4] as DokLevel[]).map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    disabled={done}
                    onClick={() => handlePick(idx, lvl)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${
                      done && lvl === item.correctDok ? `${DOK_META[lvl].color} scale-105 shadow-lg` :
                      done && lvl === chosen && !correct ? 'border-red-400 bg-red-900/40 text-red-300' :
                      'border-indigo-600 bg-indigo-800 text-indigo-300 hover:bg-indigo-700 disabled:cursor-default'
                    }`}
                  >
                    {DOK_META[lvl].label}
                  </button>
                ))}
                {done && (
                  <span className="ml-auto flex items-center gap-1 text-xs">
                    {correct
                      ? <><CheckCircle2 className="w-4 h-4 text-green-400" /><span className="text-green-400 font-bold">Точно!</span></>
                      : <><XCircle className="w-4 h-4 text-red-400" /><span className="text-red-400 font-bold">DoK {item.correctDok}</span></>
                    }
                  </span>
                )}
              </div>
              {done && (
                <p className="mt-2 text-xs text-indigo-300 italic leading-snug">{item.explanation}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const AcademyLessonView: React.FC<{ id: string }> = ({ id }) => {
  const { navigate } = useNavigation();
  const { openGeneratorPanel } = useGeneratorPanel();
  const { markLessonAsRead } = useAcademyProgress();

  const lesson = ACADEMY_CONTENT[id];

  // Mark as read when viewing
  useEffect(() => {
    if (lesson) {
      markLessonAsRead(lesson.id);
    }
  }, [lesson, markLessonAsRead]);

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

  // Handle Dynamic Action Generation Logic
  const handleTryItOut = () => {
    let statePayload: Partial<GeneratorState> = {};
    if (lesson.type === 'model') {
      statePayload.learningDesignModel = lesson.generatorKey;
    } else if (lesson.type === 'tone') {
      statePayload.scenarioTone = lesson.generatorKey;
    } else if (lesson.type === 'focus') {
      statePayload.activityFocus = lesson.generatorKey;
    }
    
    openGeneratorPanel(statePayload);
  };

  const getCategoryName = () => {
     switch(lesson.type) {
       case 'model': return 'Педагошки модел';
       case 'tone': return 'Тон на сценариото';
       case 'focus': return 'Фокус на активноста';
       case 'dok': return "Webb's Depth of Knowledge";
       case 'visual': return 'Визуелна Математика — Манипулативи';
       default: return 'Лекција';
     }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* Header Navigation */}
      <div className="border-b bg-white top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/academy')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Назад во Едукативен Центар</span>
          </button>

          <button
            type="button"
            onClick={handleTryItOut}
            className="hidden sm:flex px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg items-center gap-2 font-medium transition-colors border border-indigo-200"
          >
            <Wand2 className="w-4 h-4" />
            Генерирај час со овој пристап
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
            
            {/* Context / Theory */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                 </div>
                 <h2 className="text-2xl font-bold text-gray-800">Што претставува ова?</h2>
               </div>
               
               <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
                 {lesson.theory.map((paragraph, idx) => (
                    <p key={`${lesson.id}-p-${idx}`}>{paragraph}</p>
                 ))}
               </div>
            </div>

            {/* Practical Math Example */}
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
            
            {/* Interactive Demo (algebra-tiles or shape-3d) */}
            {lesson.interactiveDemo && (
              <div className="bg-slate-900 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                    <Target className="w-4 h-4 text-cyan-400" />
                  </div>
                  <h2 className="text-lg font-black text-cyan-300 uppercase tracking-widest">
                    {lesson.interactiveDemo === 'algebra-tiles' ? 'Интерактивна демо: Алгебарски плочки' : 'Интерактивна демо: 3D Геометрија'}
                  </h2>
                </div>
                <React.Suspense fallback={<div className="h-48 flex items-center justify-center text-slate-400">Се вчитува...</div>}>
                  {lesson.interactiveDemo === 'algebra-tiles'
                    ? <AlgebraTilesCanvas />
                    : <Shape3DViewer compact={false} />
                  }
                </React.Suspense>
              </div>
            )}

            {/* DoK Classification Exercise */}
            {lesson.dokClassifyItems && lesson.dokClassifyItems.length > 0 && (
              <DokClassifier items={lesson.dokClassifyItems} />
            )}

            {/* Mastery Quiz */}
            <AcademyQuiz lesson={lesson} />
            
            {/* Final CTA */}
            <div className="mt-8 mb-12 flex flex-col items-center p-12 bg-gray-50 border border-gray-200 rounded-3xl text-center">
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

        </div>
      </div>
      
      {/* AI Mentor */}
      <AcademyMentor lesson={lesson} />
    </div>
  );
};

import { educationalHints } from '../data/educationalModelsInfo';
import React from 'react';
import { Card } from '../components/common/Card';
import { Target, Shapes, Wand2, Play, GraduationCap, CheckCircle2, Trophy, Star, Cpu, BookOpenCheck, FlaskConical, Brain } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { useAcademyProgress, MATERIAL_ACHIEVEMENTS } from '../contexts/AcademyProgressContext';
import { slugify } from '../utils/slugify';
import { calcFibonacciLevel, getAvatar } from '../utils/gamification';
import { ACADEMY_CONTENT } from '../data/academy/content';
import { SPECIALIZATIONS } from '../data/academy/specializations';

import { AcademyCertificateButton } from '../components/academy/AcademyCertificate';
import { AcademyDailyHub } from '../components/academy/AcademyDailyHub';
import { useAuth } from '../contexts/AuthContext';

export const AcademyView: React.FC = () => {
  const { navigate } = useNavigation();
  const { user } = useAuth();
  const { progress } = useAcademyProgress();
  const { readLessons, appliedLessons, completedQuizzes, xp } = progress;
  const levelInfo = calcFibonacciLevel(xp);
  const avatar = getAvatar(levelInfo.level);

  const MODULES = [
    {
      id: 'models',
      title: 'Педагошки модели',
      description: 'Истражете структурирани пристапи за планирање кои обезбедуваат длабоко разбирање.',
      icon: Shapes,
      color: 'bg-blue-50 text-blue-600',
      borderColor: 'border-blue-200',
      topics: Object.entries(educationalHints.pedagogicalModels).map(([key, data]) => ({
        title: data.title,
        id: slugify('model ' + key)
      }))
    },
    {
      id: 'tones',
      title: 'Тон на сценариото',
      description: 'Откријте како промената на наративот и емоционалниот слој може драстично да ја зголеми мотивацијата.',
      icon: Wand2,
      color: 'bg-amber-50 text-amber-600',
      borderColor: 'border-amber-200',
      topics: Object.entries(educationalHints.tones).map(([key, _]) => ({
        title: key,
        id: slugify('tone ' + key)
      }))
    },
    {
      id: 'focuses',
      title: 'Фокус на активноста',
      description: 'Што сакате да постигнете на часот? Одговарање на различни когнитивни или социјални потреби на учениците.',
      icon: Target,
      color: 'bg-purple-50 text-purple-600',
      borderColor: 'border-purple-200',
      topics: Object.entries(educationalHints.focuses).map(([key, _]) => ({
        title: key,
        id: slugify('focus ' + key)
      }))
    },
    {
      id: 'assessment',
      title: 'Наука за оценување',
      description: 'Три научно докажани модели за сумативно оценување: Мастери, SBG и CBE. Со директна врска кон МОН стандардите.',
      icon: Brain,
      color: 'bg-green-50 text-green-700',
      borderColor: 'border-green-200',
      topics: [
        { title: 'Мастери учење — Bloom 1968', id: 'assessment-mastery-learning' },
        { title: 'Оценување по стандарди (SBG)', id: 'assessment-sbg' },
        { title: 'Компетентносно образование (CBE)', id: 'assessment-cbe' },
      ],
      badge: 'НОВО',
    }
  ];

  const totalLessons = MODULES.reduce((acc, m) => acc + m.topics.length, 0);
  const readCount = readLessons.length;
  const appliedCount = appliedLessons.length;

  // TPACK domain progress
  const allLessons = Object.values(ACADEMY_CONTENT);
  const tpackDomains = (['technology', 'pedagogy', 'content'] as const).map(domain => {
    const domainIds = allLessons.filter(l => l.tpackDomain === domain).map(l => l.id);
    const applied = domainIds.filter(id => appliedLessons.includes(id)).length;
    return { domain, total: domainIds.length, applied };
  });
  const tpackMaster = tpackDomains.every(d => d.applied >= 1);

  const TPACK_META = {
    technology: { label: 'Technology', icon: Cpu,           color: 'text-blue-600',   bar: 'bg-blue-500',   bg: 'bg-blue-50'   },
    pedagogy:   { label: 'Pedagogy',   icon: FlaskConical,  color: 'text-purple-600', bar: 'bg-purple-500', bg: 'bg-purple-50' },
    content:    { label: 'Content',    icon: BookOpenCheck, color: 'text-green-600',  bar: 'bg-green-500',  bg: 'bg-green-50'  },
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-indigo-900 to-purple-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-purple-400 opacity-20 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black">Едукативен Центар</h1>
              </div>
              <p className="text-indigo-100 text-lg max-w-2xl mt-4">
                Простор посветен за вашиот професионален развој. Истражете ги сите современи педагошки практики што се вградени во AI генераторот.
              </p>
            </div>
            
            {/* Progress Gamification Box */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 w-full md:w-auto md:min-w-[300px]">
              {/* Level + XP row */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/20">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{avatar.emoji}</span>
                  <div>
                    <p className="text-white font-bold leading-tight">{avatar.title}</p>
                    <p className="text-indigo-200 text-xs">Ниво {levelInfo.level}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                    <span className="text-yellow-300 font-bold text-sm">{xp} XP</span>
                  </div>
                  <p className="text-indigo-200 text-xs">{levelInfo.currentXp}/{levelInfo.nextLevelXp} за ниво {levelInfo.level + 1}</p>
                </div>
              </div>
              {/* XP level progress bar */}
              <div className="mb-4">
                <div className="w-full bg-white/20 rounded-full h-1.5">
                  <div className="bg-yellow-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${levelInfo.progress}%` }}></div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-green-300 font-medium">Прочитани</span>
                    <span className="text-white font-bold">{readCount}/{totalLessons}</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div className="bg-green-400 h-2 rounded-full" style={{ width: `${Math.min(100, (readCount / totalLessons) * 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-amber-300 font-medium">Применети</span>
                    <span className="text-white font-bold">{appliedCount}/{totalLessons}</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${Math.min(100, (appliedCount / totalLessons) * 100)}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-blue-300 font-medium">Квизови</span>
                    <span className="text-white font-bold">{completedQuizzes.length}/{totalLessons}</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min(100, (completedQuizzes.length / totalLessons) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Hub: Streak + AI Challenge + Competency Radar */}
      <AcademyDailyHub
        modules={MODULES}
        readLessons={readLessons}
        appliedLessons={appliedLessons}
        completedQuizzes={completedQuizzes}
      />

      {/* TPACK Section */}
      <div className={`mb-8 rounded-2xl border-2 p-6 ${tpackMaster ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100 bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">TPACK Рамка — Ваш напредок</h2>
            <p className="text-sm text-gray-500 mt-0.5">Применете барем по 1 лекција од секој домен за да го освоите TPACK Мајстор беџот</p>
          </div>
          {tpackMaster && (
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-yellow-900 rounded-xl font-bold text-sm shadow">
              <Trophy className="w-4 h-4" /> TPACK Мајстор
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tpackDomains.map(({ domain, total, applied }) => {
            const meta = TPACK_META[domain];
            const Icon = meta.icon;
            const pct = total > 0 ? Math.round((applied / total) * 100) : 0;
            const done = applied >= 1;
            return (
              <div key={domain} className={`rounded-xl p-4 ${meta.bg} border ${done ? 'border-transparent' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                  <span className={`font-bold text-sm ${meta.color}`}>{meta.label}</span>
                  {done && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
                </div>
                <div className="w-full bg-white/70 rounded-full h-2 mb-2">
                  <div className={`${meta.bar} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-500">{applied}/{total} применети</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Specializations */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Специјализации</h2>
          <p className="text-sm text-gray-500 mt-1">Применете ги сите лекции во патеката за да заработите сертификат</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {SPECIALIZATIONS.map(spec => {
              const applied = spec.lessonIds.filter(id => appliedLessons.includes(id)).length;
              const quizzed = spec.lessonIds.filter(id => completedQuizzes.includes(id)).length;
              const total = spec.lessonIds.length;
              
              const isAppliedComplete = applied === total;
              const isQuizComplete = quizzed === total;
              const completed = isAppliedComplete && isQuizComplete;
              
              const pct = Math.round(((applied + quizzed) / (total * 2)) * 100);
              return (
                <div key={spec.id} className={`rounded-2xl border-2 p-6 bg-white ${completed ? spec.borderColor : 'border-gray-100'} transition-all`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{spec.emoji}</span>
                      <div>
                        <h3 className="font-bold text-gray-900">{spec.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5 max-w-[200px]">{spec.subtitle}</p>
                      </div>
                    </div>
                    {completed && (
                      <div className="flex flex-col items-end gap-2">
                        <span className={`flex items-center gap-1 text-xs font-bold text-white px-3 py-1 rounded-full ${spec.badgeColor}`}>
                          <Trophy className="w-3 h-3" /> Сертификат
                        </span>
                        <AcademyCertificateButton 
                          userName={user?.name || 'Наставник'} 
                          specializationTitle={spec.title} 
                          date={new Date().toLocaleDateString('mk-MK')} 
                        />
                      </div>
                    )}
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                    <div className={`h-2 rounded-full transition-all duration-500 ${spec.badgeColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">Прогрес: {applied + quizzed}/{total * 2} цели остварени</p>
                  <ul className="mt-4 space-y-1.5">
                    {spec.lessonIds.map(id => {
                      const lesson = ACADEMY_CONTENT[id];
                      const isApplied = appliedLessons.includes(id);
                      const isQuizzed = completedQuizzes.includes(id);
                      return lesson ? (
                        <li
                          key={id}
                          onClick={() => navigate('/academy/lesson/' + id)}
                          className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer hover:text-brand-primary transition-colors"
                        >
                          <div className="flex items-center gap-1 w-10">
                            {isApplied ? <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200" />}
                            {isQuizzed ? <Brain className="w-3.5 h-3.5 text-blue-500" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200" />}
                          </div>
                          <span className={isApplied && isQuizzed ? 'line-through text-gray-400' : ''}>{lesson.title}</span>
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              );
            })}
        </div>
      </div>

      {/* Material Achievements */}
      {(() => {
        const stats = progress.materialStats;
        const unlocked = progress.unlockedMaterialAchievements || [];
        const total = stats?.totalSaved ?? 0;
        if (total === 0 && unlocked.length === 0) return null;
        return (
          <div className="mb-8 rounded-2xl border-2 border-gray-100 bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="w-5 h-5 text-amber-500" />
              <div>
                <h2 className="text-lg font-bold text-gray-800">Достигнувања — Библиотека материјали</h2>
                <p className="text-xs text-gray-500 mt-0.5">Зачувај материјали во библиотеката за да ги отклучиш беџите</p>
              </div>
              <span className="ml-auto text-sm font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                {total} зачувани
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {MATERIAL_ACHIEVEMENTS.map(a => {
                const earned = unlocked.includes(a.id);
                return (
                  <div
                    key={a.id}
                    title={`${a.label} — ${a.xp} XP`}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                      earned
                        ? 'border-amber-300 bg-amber-50 text-amber-800 shadow-sm'
                        : 'border-gray-100 bg-gray-50 text-gray-300'
                    }`}
                  >
                    <span className={earned ? '' : 'grayscale opacity-40'}>{a.emoji}</span>
                    <span>{a.label}</span>
                    {earned && <span className="text-xs text-amber-500 font-bold">+{a.xp}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Сите достапни модули</h2>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full text-center">Директно преземени од AI Генераторот</span>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {MODULES.map((module) => (
          <Card 
            key={module.id} 
            className={`overflow-hidden border-2 bg-white ${module.borderColor} flex flex-col`}
          >
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${module.color}`}>
                  <module.icon className="w-7 h-7" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                {module.title}
                {'badge' in module && module.badge && (
                  <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-black rounded-full uppercase tracking-wider">{module.badge as string}</span>
                )}
              </h3>
              
              <p className="text-gray-600 mb-6 text-sm flex-1">
                {module.description}
              </p>
              
              <div className="space-y-2 mt-4">
                <p className="text-xs font-bold text-gray-400 uppercase">Стручни теми:</p>
                <ul className="flex flex-col gap-2">
                  {module.topics.map((topic, i) => {
                    const isRead = readLessons.includes(topic.id);
                    const isApplied = appliedLessons.includes(topic.id);
                    return (
                    <li
                      key={i}
                      onClick={() => navigate('/academy/lesson/' + topic.id)}
                      className="group flex flex-col px-3 py-2 bg-gray-50 border border-gray-100 hover:border-brand-primary/40 hover:bg-brand-primary/5 text-gray-700 rounded-lg transition-all cursor-pointer"
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-semibold group-hover:text-brand-primary text-sm flex items-center gap-2">
                          {topic.title}
                        </span>
                        <div className="flex items-center gap-2">
                           {isApplied && (
                             <span className="flex items-center text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full" title="Успешно применето">
                               <Trophy className="w-3 h-3 mr-1" /> Применето
                             </span>
                           )}
                           {!isApplied && isRead && (
                             <span className="flex items-center text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full" title="Прочитано">
                               <CheckCircle2 className="w-3 h-3 mr-1" /> Прочитано
                             </span>
                           )}
                          <Play className="w-3 h-3 text-gray-300 group-hover:text-brand-primary transition-colors ml-1" />
                        </div>
                      </div>
                    </li>
                  )})}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>

    </div>
  );
};

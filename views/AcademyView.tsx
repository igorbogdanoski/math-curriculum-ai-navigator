import React from 'react';
import { Card } from '../components/common/Card';
import { BookOpen, Target, Cpu, Shapes, Beaker, Play, Lightbulb, GraduationCap } from 'lucide-react';
import { educationalHints } from '../data/educationalModelsInfo';

// Mock data for Phase 2 - Dashboard visualization
const MODULES = [
  {
    id: 'models',
    title: 'Модели за дизајн на часови',
    description: 'Истражете структурирани пристапи за планирање како 5E, Gagné и Flipped Classroom кои обезбедуваат длабоко разбирање.',
    icon: Shapes,
    color: 'bg-blue-50 text-blue-600',
    borderColor: 'border-blue-200',
    topics: ['5Е Модел', 'Gagné-ови 9 настани', 'Учење базирано на проблеми (УБП)']
  },
  {
    id: 'udl',
    title: 'Инклузивно образование (УДУ)',
    description: 'Универзален дизајн за учење: како да ги прилагодите активностите за да одговараат на сите стилови и потреби на учениците.',
    icon: Target,
    color: 'bg-purple-50 text-purple-600',
    borderColor: 'border-purple-200',
    topics: ['Повеќекратно претставување', 'Повеќе начини на изразување', 'Системи на ангажирање']
  },
  {
    id: 'bloom',
    title: 'Блумова таксономија во акција',
    description: 'Од меморирање до креирање. Научете како да формулирате задачи кои бараат когнитивен напор од повисок ред.',
    icon: Lightbulb,
    color: 'bg-amber-50 text-amber-600',
    borderColor: 'border-amber-200',
    topics: ['Формулација на прашања', 'Дизајн на проекти', 'Критичко мислење']
  },
  {
    id: 'tech',
    title: 'Интеграција на технологија (SAMR)',
    description: 'Скалило на технолошка примена: од едноставна замена на тетратка до редефинирање на искуството за учење.',
    icon: Cpu,
    color: 'bg-emerald-50 text-emerald-600',
    borderColor: 'border-emerald-200',
    topics: ['Substitution (Замена)', 'Augmentation (Збогатување)', 'Modification (Модификација)', 'Redefinition (Редефинирање)']
  }
];

export const AcademyView: React.FC = () => {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-indigo-900 to-purple-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-purple-400 opacity-20 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black">Едукативен Центар</h1>
          </div>
          <p className="text-indigo-100 text-lg max-w-2xl mt-4">
            Простор посветен за вашиот професионален развој. Истражете ги најдобрите современи педагошки практики и научете како ефективно да ги примените во наставата по математика.
          </p>
        </div>
        
        <div className="relative z-10 hidden lg:block">
          {/* A small abstract graphic piece */}
          <div className="grid grid-cols-2 gap-2 p-4 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-md">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-12 h-12 rounded-lg bg-white/20 animate-pulse" style={{ animationDelay: `${i*150}ms`}}></div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Достапни Модули<span className="text-brand-primary">.</span></h2>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{MODULES.length} Модули во најава</span>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MODULES.map((module, idx) => (
          <Card 
            key={module.id} 
            className={`overflow-hidden border-2 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group bg-white cursor-pointer ${module.borderColor}`}
          >
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${module.color}`}>
                  <module.icon className="w-7 h-7" />
                </div>
                <div className="px-3 py-1 bg-gray-100/80 text-gray-500 text-xs font-bold rounded-full uppercase tracking-wider">
                  Во најава 
                  {/* Фаза 3: "Модул X" */}
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-brand-primary transition-colors">
                {module.title}
              </h3>
              
              <p className="text-gray-600 mb-6 flex-grow">
                {module.description}
              </p>
              
              <div className="space-y-2 mt-auto">
                <p className="text-xs font-bold text-gray-400 uppercase">Опфатени теми:</p>
                <ul className="flex flex-wrap gap-2">
                  {module.topics.map((topic, i) => (
                    <li key={i} className="text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-100 text-gray-700 rounded-md">
                      {topic}
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Overlay for Phase 2 - indicating it's coming in Phase 3 */}
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="bg-white px-6 py-3 rounded-xl shadow-xl font-bold text-brand-primary flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                  <Play className="w-5 h-5" />
                  <span>Наскоро (Фаза 3)</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      {/* Quick Snippets (Existing tooltips expanded) */}
      <div className="mt-12 mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Брз Речник на термини<span className="text-brand-accent">.</span></h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(educationalHints.pedagogicalModels).map(([key, data]) => (
            <div key={key} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="font-bold text-brand-primary mb-1 flex justify-between items-center">
                {data.title}
                <BookOpen className="w-4 h-4 text-brand-primary/40" />
              </h4>
              <p className="text-sm text-gray-600 mb-2 leading-relaxed">{data.text}</p>
              <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50">
                <span className="text-[10px] uppercase font-black text-blue-400 block mb-0.5">Пример во пракса:</span>
                <span className="text-xs text-blue-900/80">{data.example}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

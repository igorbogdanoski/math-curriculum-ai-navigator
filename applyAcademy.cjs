const fs = require('fs');

const content = `import { educationalHints } from '../data/educationalModelsInfo';
import React from 'react';
import { Card } from '../components/common/Card';
import { Target, Shapes, Wand2, Play, GraduationCap } from 'lucide-react';
import { useNavigation } from '../contexts/NavigationContext';
import { slugify } from '../utils/slugify';

export const AcademyView: React.FC = () => {
  const { navigate } = useNavigation();

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
    }
  ];

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
            Простор посветен за вашиот професионален развој. Истражете ги сите современи педагошки практики што се вградени во AI генераторот.
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Сите достапни модули</h2>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full text-center">Директно преземени од AI Генераторот</span>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {MODULES.map((module) => (
          <Card 
            key={module.id} 
            className={\`overflow-hidden border-2 bg-white \${module.borderColor} flex flex-col\`}
          >
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className={\`p-3 rounded-xl \${module.color}\`}>
                  <module.icon className="w-7 h-7" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {module.title}
              </h3>
              
              <p className="text-gray-600 mb-6 text-sm flex-1">
                {module.description}
              </p>
              
              <div className="space-y-2 mt-4">
                <p className="text-xs font-bold text-gray-400 uppercase">Стручни теми:</p>
                <ul className="flex flex-col gap-2">
                  {module.topics.map((topic, i) => (
                    <li 
                      key={i} 
                      onClick={() => navigate('/academy/lesson/' + topic.id)}
                      className="group flex flex-col px-3 py-2 bg-gray-50 border border-gray-100 hover:border-brand-primary/40 hover:bg-brand-primary/5 text-gray-700 rounded-lg transition-all cursor-pointer"
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-semibold group-hover:text-brand-primary text-sm">{topic.title}</span>
                        <Play className="w-3 h-3 text-gray-300 group-hover:text-brand-primary transition-colors" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>

    </div>
  );
};
`;

fs.writeFileSync('views/AcademyView.tsx', content);

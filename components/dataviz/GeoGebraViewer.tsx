import React, { useState } from 'react';
import { ExternalLink, Maximize2, Calculator, Triangle, TrendingUp, Box } from 'lucide-react';

type GeoGebraApp = 'graphing' | 'geometry' | 'calculator' | '3d';

interface AppDef {
  id: GeoGebraApp;
  label: string;
  labelMk: string;
  icon: React.ReactNode;
  url: string;
  desc: string;
}

const APPS: AppDef[] = [
  {
    id: 'graphing',
    label: 'Graphing',
    labelMk: 'Функции и графици',
    icon: <TrendingUp className="h-4 w-4" />,
    url: 'https://www.geogebra.org/graphing?lang=mk',
    desc: 'Цртај функции, наоѓај пресечишта, анализирај однесување',
  },
  {
    id: 'geometry',
    label: 'Geometry',
    labelMk: 'Геометрија',
    icon: <Triangle className="h-4 w-4" />,
    url: 'https://www.geogebra.org/geometry?lang=mk',
    desc: 'Конструкции, трансформации, докажување теореми',
  },
  {
    id: 'calculator',
    label: 'CAS Calculator',
    labelMk: 'CAS Калкулатор',
    icon: <Calculator className="h-4 w-4" />,
    url: 'https://www.geogebra.org/cas?lang=mk',
    desc: 'Симболична алгебра, интеграли, диференцијали',
  },
  {
    id: '3d',
    label: '3D Calculator',
    labelMk: '3D Простор',
    icon: <Box className="h-4 w-4" />,
    url: 'https://www.geogebra.org/3d?lang=mk',
    desc: 'Тела, рамнини, вектори во просторот',
  },
];

export const GeoGebraViewer: React.FC = () => {
  const [activeApp, setActiveApp] = useState<GeoGebraApp>('graphing');
  const [fullscreen, setFullscreen] = useState(false);

  const current = APPS.find(a => a.id === activeApp)!;

  return (
    <div className={`flex flex-col gap-3 ${fullscreen ? 'fixed inset-0 z-50 bg-white p-4' : ''}`}>
      {/* App selector */}
      <div className="flex flex-wrap gap-2">
        {APPS.map(app => (
          <button
            key={app.id}
            type="button"
            onClick={() => setActiveApp(app.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
              activeApp === app.id
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {app.icon}
            {app.labelMk}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Отвори во нов таб
          </a>
          <button
            type="button"
            onClick={() => setFullscreen(f => !f)}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition"
            title={fullscreen ? 'Излез од цел екран' : 'Цел екран'}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-500">{current.desc}</p>

      {/* Iframe */}
      <div className={`overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${fullscreen ? 'flex-1' : 'h-[560px]'}`}>
        <iframe
          key={activeApp}
          src={current.url}
          title={`GeoGebra ${current.label}`}
          width="100%"
          height="100%"
          className="border-0"
          allow="fullscreen"
          loading="lazy"
        />
      </div>

      <p className="text-center text-[11px] text-slate-400">
        Powered by{' '}
        <a href="https://www.geogebra.org" target="_blank" rel="noopener noreferrer" className="underline">
          GeoGebra
        </a>{' '}
        — бесплатен математички софтвер за македонски образовни институции
      </p>
    </div>
  );
};

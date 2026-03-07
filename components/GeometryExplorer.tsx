import React, { useState } from 'react';
import { ICONS } from '../constants'; // Или import { Calculator, Ruler } from 'lucide-react';

export const GeometryExplorer = () => {
  const [width, setWidth] = useState(150);
  const [height, setHeight] = useState(100);
  const [shape, setShape] = useState<'rectangle' | 'triangle' | 'circle'>('rectangle');

  // Пресметки во живо
  const perimeter = shape === 'rectangle' ? 2 * (width + height) : 
                    shape === 'triangle' ? width + 2 * Math.sqrt((width/2)**2 + height**2) : 
                    2 * Math.PI * (width / 2); // Круг (во земаме width како дијаметар)
  
  const area = shape === 'rectangle' ? width * height : 
               shape === 'triangle' ? (width * height) / 2 : 
               Math.PI * Math.pow(width / 2, 2); // Круг

  // Скалирање за приказ (да не избега од екранот)
  const scale = 1.5; 

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-bold text-gray-700 flex items-center gap-2">
          📐 Геометриска Лабораторија
        </h3>
        <div className="flex bg-gray-200 rounded-lg p-1 text-xs font-bold">
            <button 
                onClick={() => setShape('rectangle')}
                className={`px-3 py-1 rounded ${shape === 'rectangle' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
                Правоаголник
            </button>
            <button
                onClick={() => setShape('triangle')}
                className={`px-3 py-1 rounded ${shape === 'triangle' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
                Триаголник
            </button>
            <button
                onClick={() => setShape('circle')}
                className={`px-3 py-1 rounded ${shape === 'circle' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
                Круг
            </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* ЛЕВО: Контроли */}
        <div className="w-full md:w-1/3 p-6 space-y-6 border-r border-gray-100 bg-gray-50/50">
          
          <div className="space-y-4">
            <div>
              <label className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                <span>Ширина (a)</span>
                <span className="text-blue-600">{width} cm</span>
              </label>
              <input 
                type="range" min="20" max="250" value={width} 
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div>
              <label className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                <span>Висина (b)</span>
                <span className="text-green-600">{height} cm</span>
              </label>
              <input 
                type="range" min="20" max="250" value={height} 
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Периметар (L)</span>
                <span className="text-lg font-mono font-bold text-gray-800">{Math.round(perimeter)} cm</span>
            </div>
            <div className="w-full border-b border-gray-100"></div>
            <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Плоштина (P)</span>
                <span className="text-lg font-mono font-bold text-gray-800">{Math.round(area)} cm²</span>
            </div>
          </div>
          
          <div className="text-xs text-gray-400 italic">
            * Промени ги лизгачите за да видиш како се менува формата.
          </div>
        </div>

        {/* ДЕСНО: Визуелизација */}
        <div className="flex-1 relative h-[350px] bg-white flex items-center justify-center">
            {/* Grid позадина */}
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

            <svg width="100%" height="100%" viewBox="0 0 400 400" className="overflow-visible relative z-10">
                <g transform="translate(200, 200)"> {/* Центар на канвасот */}
                    
                    {shape === 'rectangle' ? (
                        <>
                            {/* Правоаголник */}
                            <rect 
                                x={-width / 2} 
                                y={-height / 2} 
                                width={width} 
                                height={height} 
                                fill="rgba(59, 130, 246, 0.1)" 
                                stroke="#2563EB" 
                                strokeWidth="3"
                                rx="4"
                                className="transition-all duration-300 ease-out"
                            />
                            {/* Коти */}
                            <text x={0} y={-height / 2 - 10} textAnchor="middle" fill="#2563EB" fontSize="12" fontWeight="bold">a = {width}</text>
                            <text x={width / 2 + 15} y={0} textAnchor="middle" fill="#16A34A" fontSize="12" fontWeight="bold" style={{writingMode: "vertical-rl"}}>b = {height}</text>
                        </>
                    ) : shape === 'triangle' ? (
                        <>
                            {/* Триаголник (Рамнокрак за пример) */}
                            <path 
                                d={`M ${-width/2} ${height/2} L ${width/2} ${height/2} L 0 ${-height/2} Z`}
                                fill="rgba(59, 130, 246, 0.1)" 
                                stroke="#2563EB" 
                                strokeWidth="3"
                                className="transition-all duration-300 ease-out"
                            />
                            {/* Висина линија */}
                            <line x1="0" y1={-height/2} x2="0" y2={height/2} stroke="#16A34A" strokeWidth="1" strokeDasharray="4" />
                            
                            <text x={0} y={height / 2 + 20} textAnchor="middle" fill="#2563EB" fontSize="12" fontWeight="bold">a = {width}</text>
                            <text x={10} y={0} fill="#16A34A" fontSize="12" fontWeight="bold">h = {height}</text>
                        </>
                    ) : (
                        <>
                            {/* Круг */}
                            <circle 
                                cx="0" 
                                cy="0" 
                                r={width / 2} 
                                fill="rgba(59, 130, 246, 0.1)" 
                                stroke="#2563EB" 
                                strokeWidth="3"
                                className="transition-all duration-300 ease-out"
                            />
                            {/* Радиус линија */}
                            <line x1="0" y1="0" x2={width/2} y2="0" stroke="#16A34A" strokeWidth="1" strokeDasharray="4" />
                            
                            <text x={width / 4} y="-10" textAnchor="middle" fill="#16A34A" fontSize="12" fontWeight="bold">r = {Math.round(width / 2)}</text>
                        </>
                    )}
                    
                </g>
            </svg>
        </div>
      </div>
    </div>
  );
};

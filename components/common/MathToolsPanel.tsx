import React, { useState } from 'react';
import { PenTool, Box, LineChart, Maximize2, Minimize2, X } from 'lucide-react';
import { DigitalScratchpad } from './DigitalScratchpad';

interface Props {
  onClose?: () => void;
  className?: string;
}

export const MathToolsPanel: React.FC<Props> = ({ onClose, className = '' }) => {
  const [activeTool, setActiveTool] = useState<'scratchpad' | 'geogebra' | 'desmos'>('scratchpad');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`flex flex-col h-full bg-white transition-all duration-300 ${isExpanded ? 'fixed inset-0 z-50 md:relative md:inset-auto' : ''} ${className}`}>
      {/* Header & Tabs */}
      <div className="flex-none p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTool('scratchpad')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTool === 'scratchpad' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <PenTool size={16} />
            <span className="hidden sm:inline">Скицирање</span>
          </button>
          <button
            onClick={() => setActiveTool('geogebra')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTool === 'geogebra' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Box size={16} />
            <span className="hidden sm:inline">GeoGebra</span>
          </button>
          <button
            onClick={() => setActiveTool('desmos')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              activeTool === 'desmos' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LineChart size={16} />
            <span className="hidden sm:inline">Графикони</span>
          </button>
        </div>
        
        <div className="flex items-center gap-1">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                title={isExpanded ? "Намали" : "Зголеми на цел екран"}
            >
                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            {onClose && (
                <button 
                    onClick={onClose}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Затвори"
                >
                    <X size={18} />
                </button>
            )}
        </div>
      </div>

      {/* Tool Content Area */}
      <div className="flex-1 w-full bg-white relative overflow-hidden flex flex-col">
        {activeTool === 'scratchpad' && (
           <DigitalScratchpad className="flex-1 w-full min-h-[300px] border-0 rounded-none" />
        )}
        
        {activeTool === 'geogebra' && (
          <div className="flex-1 w-full h-full p-2 bg-gray-50 relative">
             <iframe
                title="GeoGebra Geometry"
                src="https://www.geogebra.org/geometry?embed"
                className="absolute inset-0 w-full h-full border-0 rounded-lg shadow-inner bg-white"
                allowFullScreen
              />
          </div>
        )}

        {activeTool === 'desmos' && (
          <div className="flex-1 w-full h-full p-2 bg-gray-50 relative">
             <iframe
                title="Desmos Graphing Calculator"
                src="https://www.desmos.com/calculator"
                className="absolute inset-0 w-full h-full border-0 rounded-lg shadow-inner bg-white"
                allowFullScreen
              />
          </div>
        )}
      </div>
    </div>
  );
};

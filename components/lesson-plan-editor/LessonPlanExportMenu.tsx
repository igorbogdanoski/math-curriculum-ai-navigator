import React, { useEffect, useRef } from 'react';
import { ICONS } from '../../constants';
import type { ExportFormat } from './useLessonPlanExport';

interface LessonPlanExportMenuProps {
  disabled: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isGeneratingWord: boolean;
  onExport: (format: ExportFormat) => void;
}

export const LessonPlanExportMenu: React.FC<LessonPlanExportMenuProps> = ({
  disabled, isOpen, setIsOpen, isGeneratingWord, onExport,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 bg-gray-600 text-white px-4 py-3 rounded-lg shadow hover:bg-gray-700 transition-colors font-semibold disabled:bg-gray-400"
        title="Извези ја оваа нацрт-подготовка"
      >
        <ICONS.download className="w-5 h-5" />
        Извези
        <ICONS.chevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-72 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 animate-fade-in-up">
          <div className="py-1">
            <button type="button" onClick={() => onExport('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <ICONS.download className="w-5 h-5 mr-3" /> Сними како Markdown (.md)
            </button>
            <button type="button" onClick={() => onExport('doc')} disabled={isGeneratingWord} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50">
              {isGeneratingWord ? <ICONS.spinner className="w-5 h-5 mr-3 animate-spin" /> : <ICONS.edit className="w-5 h-5 mr-3" />}
              {isGeneratingWord ? 'Генерирам Word...' : 'Сними како Word (.doc)'}
            </button>
            <button type="button" onClick={() => onExport('ics')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <ICONS.calendar className="w-5 h-5 mr-3" /> Сними како Календар (.ics)
            </button>
            <button type="button" onClick={() => onExport('google')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <ICONS.calendar className="w-5 h-5 mr-3 text-blue-600" /> Додај во Google Calendar
            </button>
            <button type="button" onClick={() => onExport('teams')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <ICONS.externalLink className="w-5 h-5 mr-3 text-indigo-600" /> Сподели во Microsoft Teams
            </button>
            <button type="button" onClick={() => onExport('pdf')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <ICONS.printer className="w-5 h-5 mr-3" /> Печати/Сними како PDF
            </button>
            <button type="button" onClick={() => onExport('clipboard')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <ICONS.edit className="w-5 h-5 mr-3" /> Копирај како обичен текст
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

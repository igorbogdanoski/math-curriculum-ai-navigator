import React from 'react';
import { ICONS } from '../../constants';
import type { LessonPlan } from '../../types';
import { LessonPlanOfficialForm } from '../planner/LessonPlanOfficialForm';
import { BROLessonScenarioForm } from '../planner/BROLessonScenarioForm';

interface OfficialLessonFormModalProps {
  plan: Partial<LessonPlan>;
  template: 'mon' | 'bro';
  setTemplate: (t: 'mon' | 'bro') => void;
  orientation: 'portrait' | 'landscape';
  setOrientation: (o: 'portrait' | 'landscape') => void;
  isEditable: boolean;
  setIsEditable: (updater: (v: boolean) => boolean) => void;
  onPrint: () => void;
  onClose: () => void;
  formRef: React.RefObject<HTMLDivElement | null>;
}

export const OfficialLessonFormModal: React.FC<OfficialLessonFormModalProps> = ({
  plan, template, setTemplate, orientation, setOrientation,
  isEditable, setIsEditable, onPrint, onClose, formRef,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in no-print"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Официјален образец за Подготовка за час"
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full overflow-hidden flex flex-col max-h-[95vh] ${template === 'bro' || orientation === 'landscape' ? 'max-w-6xl' : 'max-w-4xl'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3 border-b flex-shrink-0 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-bold text-brand-primary flex items-center gap-2">
            <ICONS.printer className="w-5 h-5" />
            Подготовка за наставен час — МОН образец
          </h2>
          <div className="flex items-center gap-2 flex-wrap">

            {/* Template switcher */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-bold">
              <button
                type="button"
                onClick={() => setTemplate('mon')}
                title="МОН Цели (когнитивни, психомоторни, афективни)"
                className={`px-3 py-1.5 transition-colors ${template === 'mon' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                📋 МОН Образец
              </button>
              <button
                type="button"
                onClick={() => setTemplate('bro')}
                title="БРО табела — Содржина / Стандарди / Сценарио / Средства / Следење"
                className={`px-3 py-1.5 border-l border-gray-300 transition-colors ${template === 'bro' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                📊 БРО Табела
              </button>
            </div>

            {/* Orientation toggle — hidden for BRO (always landscape) */}
            {template === 'mon' && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  title="A4 Portrait (вертикален)"
                  className={`px-2.5 py-1.5 transition-colors ${orientation === 'portrait' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  ▯ Portrait
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  title="A4 Landscape (хоризонтален) — препорачано"
                  className={`px-2.5 py-1.5 border-l border-gray-200 transition-colors ${orientation === 'landscape' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  ▭ Landscape
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsEditable(v => !v)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-colors ${
                isEditable
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ICONS.edit className="w-4 h-4" />
              {isEditable ? 'Прегледај' : 'Уреди'}
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="px-3 py-1.5 bg-brand-accent text-white rounded-lg flex items-center gap-2 text-sm hover:bg-opacity-90"
            >
              <ICONS.printer className="w-4 h-4" />
              Испечати
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-200"
              aria-label="Затвори"
            >
              <ICONS.close className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {isEditable && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-sm text-blue-700 flex-shrink-0">
            <ICONS.edit className="w-4 h-4 flex-shrink-0" />
            <span>Режим на уредување — кликни на полињата за да внесеш промени пред печатење</span>
          </div>
        )}

        {/* Scrollable form */}
        <div className="overflow-auto flex-1 p-4 bg-gray-100">
          <div
            ref={formRef}
            className={`bg-white shadow-sm mx-auto ${
              template === 'bro'
                ? 'max-w-5xl p-6'
                : orientation === 'landscape' ? 'max-w-4xl' : 'max-w-2xl'
            }`}
          >
            {template === 'mon' ? (
              <LessonPlanOfficialForm
                plan={plan}
                orientation={orientation}
                isEditable={isEditable}
              />
            ) : (
              <BROLessonScenarioForm
                plan={plan}
                isEditable={isEditable}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

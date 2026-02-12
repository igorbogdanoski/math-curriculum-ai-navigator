import React from 'react';
import type { LessonPlan } from '../../types';
import { ICONS } from '../../constants';
import { useModal } from '../../contexts/ModalContext';
import { usePlanner } from '../../contexts/PlannerContext';
import { MathRenderer } from '../common/MathRenderer';
import { useNavigation } from '../../contexts/NavigationContext';

interface LessonPlanQuickViewModalProps {
  lessonPlanId: string;
}

export const LessonPlanQuickViewModal: React.FC<LessonPlanQuickViewModalProps> = ({ lessonPlanId }) => {
  const { navigate } = useNavigation();
  const { hideModal } = useModal();
  const { getLessonPlan } = usePlanner();
  const lessonPlan = getLessonPlan(lessonPlanId);

  if (!lessonPlan) {
    return null; 
  }

  const handleEdit = () => {
    hideModal();
    navigate(`/planner/lesson/${lessonPlan.id}`);
  };

  const handleViewDetails = () => {
    hideModal();
    navigate(`/planner/lesson/view/${lessonPlan.id}`);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in-up"
      onClick={hideModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <div className="p-5 bg-brand-primary text-white rounded-t-lg">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                    <ICONS.bookOpen className="w-6 h-6" />
                </div>
                <div>
                    <h2 id="quick-view-title" className="text-xl font-bold"><MathRenderer text={lessonPlan.title} /></h2>
                    <p className="text-sm text-blue-200">{lessonPlan.grade}. одделение - Брз преглед</p>
                </div>
            </div>
            <button type="button" onClick={hideModal} className="p-1 rounded-full text-white hover:bg-white/20">
              <ICONS.close className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4 max-h-80 overflow-y-auto">
          <div>
            <h3 className="font-semibold text-brand-secondary mb-2">Наставни цели:</h3>
            <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
              {lessonPlan.objectives.map((obj: any, i: number) => <li key={i}><MathRenderer text={typeof obj === 'string' ? obj : obj.text} /></li>)}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-brand-secondary mb-2">Сценарио:</h3>
            <div className="text-gray-700 text-sm space-y-2">
              <p><strong>Вовед:</strong> <MathRenderer text={typeof lessonPlan.scenario.introductory === 'string' ? lessonPlan.scenario.introductory : lessonPlan.scenario.introductory.text} /></p>
              <div>
                <strong>Главни активности:</strong>
                <ul className="list-decimal list-inside ml-4">
                  {lessonPlan.scenario.main.map((act: any, i: number) => <li key={i}><MathRenderer text={typeof act === 'string' ? act : act.text} /></li>)}
                </ul>
              </div>
              <p><strong>Завршна активност:</strong> <MathRenderer text={typeof lessonPlan.scenario.concluding === 'string' ? lessonPlan.scenario.concluding : lessonPlan.scenario.concluding.text} /></p>
            </div>
          </div>
        </div>
        <div className="flex justify-end items-center bg-gray-50 p-4 rounded-b-lg space-x-3">
          <button
            onClick={handleViewDetails}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
          >
            Види целосна подготовка
          </button>
          <button
            onClick={handleEdit}
            className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary"
          >
            <ICONS.edit className="w-5 h-5 mr-2" />
            Уреди
          </button>
        </div>
      </div>
    </div>
  );
};
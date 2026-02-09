import React, { useMemo, useState } from 'react';
import { shareService } from '../services/shareService';
import { ICONS } from '../constants';
import { usePlanner } from '../contexts/PlannerContext';
import { useNotification } from '../contexts/NotificationContext';
import { LessonPlanDisplay } from '../components/planner/LessonPlanDisplay';
import { NotFoundView } from './NotFoundView';
import { useNavigation } from '../contexts/NavigationContext';

interface SharedPlanViewProps {
  data: string;
}

export const SharedPlanView: React.FC<SharedPlanViewProps> = ({ data }) => {
  const { navigate } = useNavigation();
  const { addLessonPlan } = usePlanner();
  const { addNotification } = useNotification();
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  
  const plan = useMemo(() => shareService.decodeShareData(data), [data]);

  const handleImport = async () => {
    if (plan && !isImporting) {
      setIsImporting(true);
      try {
        await addLessonPlan(plan);
        addNotification(`Подготовката "${plan.title}" е успешно увезена!`, 'success');
        setImportSuccess(true);
        setTimeout(() => {
          navigate('/my-lessons');
        }, 1500);
      } catch (error) {
        addNotification('Настана грешка при увозот.', 'error');
        setIsImporting(false);
      }
    }
  };

  if (!plan) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600">Линкот за споделување е невалиден или оштетен.</h2>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-brand-primary text-white rounded">
          Врати се на почетна
        </button>
      </div>
    );
  }

  const getButtonContent = () => {
    if (importSuccess) {
      return (
        <>
          <ICONS.check className="w-5 h-5 mr-2" /> Успешно увезено!
        </>
      );
    }
    if (isImporting) {
      return (
        <>
          <ICONS.spinner className="animate-spin w-5 h-5 mr-2" /> Се увезува...
        </>
      );
    }
    return (
      <>
        <ICONS.plus className="w-5 h-5 mr-2" /> Увези во мојата библиотека
      </>
    );
  }

  return (
    <div className="p-8 animate-fade-in">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold text-brand-primary">{plan.title}</h1>
          <p className="text-lg text-gray-600 mt-2">Споделена подготовка за час ({plan.grade}. одделение)</p>
        </div>
        <button 
          onClick={handleImport} 
          disabled={isImporting || importSuccess}
          className={`flex items-center px-4 py-2 rounded-lg shadow transition-colors ${
            importSuccess 
              ? 'bg-green-600 text-white' 
              : 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400'
          }`}
        >
          {getButtonContent()}
        </button>
      </header>
      
      <LessonPlanDisplay plan={plan} />
    </div>
  );
};
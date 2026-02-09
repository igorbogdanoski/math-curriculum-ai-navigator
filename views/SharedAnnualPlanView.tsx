import React, { useMemo, useState } from 'react';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { usePlanner } from '../contexts/PlannerContext';
import { useNotification } from '../contexts/NotificationContext';
import { shareService } from '../services/shareService';
import { useNavigation } from '../contexts/NavigationContext';

interface SharedAnnualPlanViewProps {
  data: string;
}

export const SharedAnnualPlanView: React.FC<SharedAnnualPlanViewProps> = ({ data }) => {
  const { navigate } = useNavigation();
  const { importAnnualPlan } = usePlanner();
  const { addNotification } = useNotification();
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  
  const planData = useMemo(() => shareService.decodeAnnualShareData(data), [data]);

  const handleImport = async () => {
    if (planData && !isImporting) {
      setIsImporting(true);
      try {
        await importAnnualPlan(planData);
        addNotification(`Годишниот план е успешно увезен!`, 'success');
        setImportSuccess(true);
        setTimeout(() => {
          navigate('/planner');
        }, 1500);
      } catch (error) {
        addNotification('Настана грешка при увозот.', 'error');
        setIsImporting(false);
      }
    }
  };

  if (!planData) {
    return (
      <div className="p-8 text-center">
        <Card>
            <h2 className="text-2xl font-bold text-red-600">Линкот за споделување е невалиден или оштетен.</h2>
            <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-brand-primary text-white rounded">
            Врати се на почетна
            </button>
        </Card>
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
        <ICONS.plus className="w-5 h-5 mr-2" /> Потврди и увези го планот
      </>
    );
  }

  return (
    <div className="p-8 animate-fade-in">
      <header className="mb-6">
        <h1 className="text-4xl font-bold text-brand-primary">Увоз на Годишен План</h1>
        <p className="text-lg text-gray-600 mt-2">Прегледајте ги деталите пред да го додадете овој план во вашиот планер.</p>
      </header>
      
      <Card>
        <div className="text-center">
            <ICONS.share className="w-12 h-12 mx-auto text-brand-secondary mb-4" />
            <h2 className="text-xl font-semibold">Подготвени сте да го увезете овој план?</h2>
            <p className="text-gray-600 mt-2">
                Овој годишен план содржи <span className="font-bold">{planData.items.length}</span> настани и <span className="font-bold">{planData.lessonPlans.length}</span> поврзани подготовки за час.
            </p>
            <p className="text-sm text-gray-500 mt-1">
                Со увозот, сите овие ставки ќе бидат додадени во вашиот планер како копии. Вашите постоечки податоци нема да бидат избришани.
            </p>
             <button 
                onClick={handleImport} 
                disabled={isImporting || importSuccess}
                className={`mt-6 flex items-center justify-center mx-auto px-6 py-3 rounded-lg shadow font-bold transition-colors ${
                  importSuccess 
                    ? 'bg-green-600 text-white' 
                    : 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400'
                }`}
            >
                {getButtonContent()}
            </button>
        </div>
      </Card>
    </div>
  );
};
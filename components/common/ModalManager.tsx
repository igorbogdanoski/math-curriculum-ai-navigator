import React from 'react';
import { useModal } from '../../contexts/ModalContext';
import { ModalType, type NationalStandard, type PlannerItem } from '../../types';

// Import modal components
import { PlannerItemModal } from '../planner/PlannerItemModal';
import { LessonPlanQuickViewModal } from '../planner/LessonPlanQuickViewModal';
import { TransversalStandardsModal } from '../explore/TransversalStandardsModal';
import { AIAnnualPlanGeneratorModal } from '../planner/AIAnnualPlanGeneratorModal';
import { AIThematicPlanGeneratorModal } from '../planner/AIThematicPlanGeneratorModal';
import { LessonReflectionModal } from '../planner/LessonReflectionModal';
import { NationalStandardDetailsModal } from '../explore/NationalStandardDetailsModal';
import { ConfirmDialog } from './ConfirmDialog';

export const ModalManager: React.FC = () => {
  const { modal } = useModal();

  if (!modal) {
    return null;
  }

  const { type, props } = modal;

  switch (type) {
    case ModalType.PlannerItem:
      return <PlannerItemModal {...props} />;
    
    case ModalType.LessonQuickView:
      return <LessonPlanQuickViewModal {...(props as { lessonPlanId: string })} />;
    
    case ModalType.TransversalStandards:
      return <TransversalStandardsModal {...(props as { standards: NationalStandard[], gradeTitle: string })} />;
    
    case ModalType.AIAnnualPlanGenerator:
        return <AIAnnualPlanGeneratorModal {...props} />;
    
    case ModalType.AIThematicPlanGenerator:
        return <AIThematicPlanGeneratorModal {...props} />;
    
    case ModalType.LessonReflection:
        return <LessonReflectionModal {...(props as { item: PlannerItem })} />;
      
    case ModalType.NationalStandardDetails:
      return <NationalStandardDetailsModal {...(props as { standard: NationalStandard })} />;

    case ModalType.Confirm:
      return <ConfirmDialog {...(props as { message: string; title?: string; confirmLabel?: string; cancelLabel?: string; variant?: 'danger' | 'warning' | 'info'; onConfirm: () => void; onCancel: () => void })} />;

    default:
      return null;
  }
};
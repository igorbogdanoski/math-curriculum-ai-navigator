import React, { Suspense, lazy } from 'react';
import { useModal } from '../../contexts/ModalContext';
import { ModalType, type NationalStandard, type PlannerItem } from '../../types';
import { ModalContainer } from './ModalContainer';
import { ConfirmDialog } from './ConfirmDialog';

// Lazy-loaded modal registry.
// Rationale: static cross-imports (ModalManager → modal → useModal) created
// 7 circular dependencies; lazy() defers module evaluation, breaking cycles
// at bundler + runtime level AND keeps heavy modal chunks out of the initial
// JS bundle (code-split at chunk granularity by Vite/Rollup).
const PlannerItemModal               = lazy(() => import('../planner/PlannerItemModal').then(m => ({ default: m.PlannerItemModal })));
const LessonPlanQuickViewModal       = lazy(() => import('../planner/LessonPlanQuickViewModal').then(m => ({ default: m.LessonPlanQuickViewModal })));
const TransversalStandardsModal      = lazy(() => import('../explore/TransversalStandardsModal').then(m => ({ default: m.TransversalStandardsModal })));
const AIAnnualPlanGeneratorModal     = lazy(() => import('../planner/AIAnnualPlanGeneratorModal').then(m => ({ default: m.AIAnnualPlanGeneratorModal })));
const AIThematicPlanGeneratorModal   = lazy(() => import('../planner/AIThematicPlanGeneratorModal').then(m => ({ default: m.AIThematicPlanGeneratorModal })));
const LessonReflectionModal          = lazy(() => import('../planner/LessonReflectionModal').then(m => ({ default: m.LessonReflectionModal })));
const NationalStandardDetailsModal   = lazy(() => import('../explore/NationalStandardDetailsModal').then(m => ({ default: m.NationalStandardDetailsModal })));

const ModalFallback: React.FC = () => (
  <div className="flex items-center justify-center p-10 text-sm text-slate-500">
    Вчитување…
  </div>
);

export const ModalManager: React.FC = () => {
  const { modal, hideModal } = useModal();

  if (!modal) {
    return null;
  }

  const { type, props } = modal;

  const renderModalContent = () => {
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
          return <AIThematicPlanGeneratorModal {...props} hideModal={hideModal} />;

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

  // If it's a Confirm dialog, it handles its own backdrop and container for now
  // (to avoid double nesting or styling conflicts). ConfirmDialog is eager
  // because it must open instantly (e.g. "are you sure?" flows).
  if (type === ModalType.Confirm) {
    return renderModalContent();
  }

  return (
    <ModalContainer onClose={hideModal}>
      <Suspense fallback={<ModalFallback />}>
        {renderModalContent()}
      </Suspense>
    </ModalContainer>
  );
};
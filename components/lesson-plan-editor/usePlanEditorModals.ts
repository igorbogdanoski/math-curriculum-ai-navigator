import { useCallback, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import type { MathToolTab } from '../common/MathToolsPanel';

export type OfficialLessonOrientation = 'portrait' | 'landscape';
export type OfficialLessonTemplate = 'mon' | 'bro';

export interface ConfirmDialogState {
  message: string;
  title?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
}

const BRO_PAGE_STYLE = `@page { size: A4 landscape; margin: 10mm 12mm; } * { box-sizing: border-box; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; } body > div { max-width: 100% !important; width: 100% !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; } table { border-collapse: collapse !important; width: 100% !important; } thead { display: table-header-group !important; } tbody tr { break-inside: avoid !important; page-break-inside: avoid !important; }`;

const monPageStyle = (orientation: OfficialLessonOrientation) =>
  `@page { size: A4 ${orientation}; margin: 10mm; } * { box-sizing: border-box; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; } body > div { max-width: 100% !important; width: 100% !important; box-shadow: none !important; margin: 0 !important; } table { border-collapse: collapse !important; } thead { display: table-header-group !important; } tbody tr { break-inside: avoid !important; page-break-inside: avoid !important; } textarea, input[type="text"] { border: none !important; outline: none !important; resize: none !important; background: transparent !important; font-family: inherit !important; font-size: inherit !important; padding: 0 !important; } input[type="checkbox"] { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }`;

interface UsePlanEditorModalsParams {
  id?: string;
}

/** Bundles the lesson-plan editor's modal/dialog open-state flags and the official-lesson print setup — pure UI state, no plan-data mutation. */
export function usePlanEditorModals({ id }: UsePlanEditorModalsParams) {
  const [execOpen, setExecOpen] = useState(false);
  const [showMathTools, setShowMathTools] = useState(false);
  const [mathToolsTab, setMathToolsTab] = useState<MathToolTab>('scratchpad');
  const [showOfficialLessonForm, setShowOfficialLessonForm] = useState(false);
  const [officialLessonEditing, setOfficialLessonEditing] = useState(false);
  const [officialLessonOrientation, setOfficialLessonOrientation] = useState<OfficialLessonOrientation>('landscape');
  const [officialLessonTemplate, setOfficialLessonTemplate] = useState<OfficialLessonTemplate>('mon');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showEditMetadataDialog, setShowEditMetadataDialog] = useState(false);
  const [isPublishingToBank, setIsPublishingToBank] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const lessonOfficialFormRef = useRef<HTMLDivElement>(null);

  const handleLessonOfficialPrint = useReactToPrint({
    contentRef: lessonOfficialFormRef,
    documentTitle: `Сценарио_на_час_${id ?? 'novo'}`,
    pageStyle: officialLessonTemplate === 'bro' ? BRO_PAGE_STYLE : monPageStyle(officialLessonOrientation),
  });

  const openMathTools = useCallback((tab: MathToolTab) => {
    setMathToolsTab(tab);
    setShowMathTools(true);
  }, []);

  return {
    execOpen, setExecOpen,
    showMathTools, setShowMathTools,
    mathToolsTab, setMathToolsTab, openMathTools,
    showOfficialLessonForm, setShowOfficialLessonForm,
    officialLessonEditing, setOfficialLessonEditing,
    officialLessonOrientation, setOfficialLessonOrientation,
    officialLessonTemplate, setOfficialLessonTemplate,
    showPublishDialog, setShowPublishDialog,
    showEditMetadataDialog, setShowEditMetadataDialog,
    isPublishingToBank, setIsPublishingToBank,
    confirmDialog, setConfirmDialog,
    lessonOfficialFormRef,
    handleLessonOfficialPrint,
  };
}

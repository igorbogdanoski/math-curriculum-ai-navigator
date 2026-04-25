import { useCallback, useState } from 'react';
import { logger } from '../../utils/logger';
import type { LessonPlan, TeachingProfile } from '../../types';
import { exportLessonPlanToWord } from '../../utils/wordExport';
import { generateLessonICS, downloadICS, getGoogleCalendarUrl } from '../../utils/icalExport';
import { buildPlanFullText, buildPlanMarkdown, sanitizeFilename } from './lessonPlanEditorHelpers';

export type ExportFormat = 'md' | 'pdf' | 'doc' | 'clipboard' | 'ics' | 'google' | 'teams';

interface Params {
  plan: Partial<LessonPlan>;
  user: TeachingProfile | null;
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function useLessonPlanExport({ plan, user, addNotification }: Params) {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!plan || !plan.title) {
      addNotification('Насловот е задолжителен за извоз.', 'error');
      return;
    }
    setIsExportMenuOpen(false);

    if (format === 'pdf') {
      window.print();
      return;
    }

    if (format === 'clipboard') {
      navigator.clipboard.writeText(buildPlanFullText(plan))
        .then(() => addNotification('Подготовката е копирана како обичен текст.', 'success'))
        .catch(() => addNotification('Грешка при копирање.', 'error'));
      return;
    }

    const filename = sanitizeFilename(plan.title || 'plan');

    if (format === 'doc') {
      setIsGeneratingWord(true);
      try {
        await exportLessonPlanToWord(plan as LessonPlan, user || undefined);
        addNotification('Word документот е успешно преземен', 'success');
      } catch (error) {
        logger.error('Export to Word failed:', error);
        addNotification('Грешка при генерирање на Word документ.', 'error');
      } finally {
        setIsGeneratingWord(false);
      }
      return;
    }

    if (format === 'ics') {
      try {
        const ics = generateLessonICS(plan as LessonPlan);
        downloadICS(ics, `${filename}.ics`);
        addNotification('Календарскиот настан е успешно преземен', 'success');
      } catch (error) {
        logger.error('Export to ICS failed:', error);
        addNotification('Грешка при генерирање на ICS.', 'error');
      }
      return;
    }

    if (format === 'google') {
      try {
        const url = getGoogleCalendarUrl(plan as LessonPlan);
        window.open(url, '_blank');
        addNotification('Се отвора Google Calendar...', 'success');
      } catch (error) {
        logger.error('Google Calendar link failed:', error);
        addNotification('Грешка при креирање на Google Calendar линк.', 'error');
      }
      return;
    }

    if (format === 'teams') {
      const teamsUrl = `https://teams.microsoft.com/share?href=${encodeURIComponent(window.location.href)}&msgText=${encodeURIComponent(`Погледнете ја мојата подготовка за час по Математика: ${plan.title}`)}`;
      window.open(teamsUrl, '_blank');
      addNotification('Се отвора Microsoft Teams...', 'info');
      return;
    }

    if (format === 'md') {
      try {
        const blob = new Blob([buildPlanMarkdown(plan)], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addNotification('Документот е преземен.', 'success');
      } catch (error) {
        logger.error('Export failed:', error);
        addNotification('Грешка при преземање на документот.', 'error');
      }
      return;
    }

    addNotification(`Извозот во .${format} формат не е имплементиран тука.`, 'info');
  }, [plan, user, addNotification]);

  return {
    isExportMenuOpen,
    setIsExportMenuOpen,
    isGeneratingWord,
    handleExport,
  };
}

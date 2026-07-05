import { useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';

/** Shared "share a student's report with a parent" concern — used by both the
 *  gradebook's entries table row menu and its Early Warning panel. */
export function useParentSharing() {
  const { addNotification } = useNotification();
  const [copiedParent, setCopiedParent] = useState<string | null>(null);
  const [shareMenuStudent, setShareMenuStudent] = useState<string | null>(null);

  const getParentUrl = (studentName: string) =>
    `${window.location.origin}/#/parent?name=${encodeURIComponent(studentName)}`;

  const handleCopyParentLink = (studentName: string) => {
    navigator.clipboard.writeText(getParentUrl(studentName)).then(() => {
      setCopiedParent(studentName);
      setShareMenuStudent(null);
      addNotification(`Линк за родител на ${studentName} е копиран!`, 'success');
      setTimeout(() => setCopiedParent(null), 2500);
    }).catch(() => addNotification('Не можевме да го копираме линкот.', 'error'));
  };

  const handleShareWhatsApp = (studentName: string, avgPct?: number, tests?: string[]) => {
    const url = getParentUrl(studentName);
    const lines = [
      `📚 *MisMath — Извештај за ученик*`,
      `Ученик: *${studentName}*`,
      avgPct !== undefined ? `Просечен успех: *${avgPct}%*` : '',
      tests && tests.length > 0
        ? `Последни резултати:\n${tests.slice(0, 3).map(t => `  • ${t}`).join('\n')}`
        : '',
      `\n🔗 Прегледај го целосниот извештај:\n${url}`,
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank', 'noopener');
    setShareMenuStudent(null);
  };

  const handleShareViber = (studentName: string, avgPct?: number, tests?: string[]) => {
    const url = getParentUrl(studentName);
    const lines = [
      `📚 MisMath — Извештај за ученик`,
      `Ученик: ${studentName}`,
      avgPct !== undefined ? `Просечен успех: ${avgPct}%` : '',
      tests && tests.length > 0
        ? `Последни резултати: ${tests.slice(0, 2).join(', ')}`
        : '',
      `Прегледај го извештајот: ${url}`,
    ].filter(Boolean).join('\n');
    window.open(`viber://forward?text=${encodeURIComponent(lines)}`, '_blank', 'noopener');
    setShareMenuStudent(null);
  };

  // legacy alias kept for table-row icon
  const handleShareParent = (studentName: string) => {
    setShareMenuStudent(prev => prev === studentName ? null : studentName);
  };

  return {
    copiedParent,
    shareMenuStudent,
    setShareMenuStudent,
    handleCopyParentLink,
    handleShareWhatsApp,
    handleShareViber,
    handleShareParent,
  };
}

export type ParentSharing = ReturnType<typeof useParentSharing>;

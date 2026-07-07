import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cloud, ChevronDown, Loader2 } from 'lucide-react';
import { pickFromGoogleDrive } from '../../services/cloudImport/googleDrivePicker';
import { pickFromDropbox } from '../../services/cloudImport/dropboxChooser';
import { pickFromOneDrive } from '../../services/cloudImport/oneDrivePicker';
import { CloudImportError, type CloudProvider } from '../../services/cloudImport/types';

interface CloudImportMenuProps {
  onFileSelected: (file: File) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  /** Matches the surrounding surface — 'dark' for glassmorphism heroes, 'light' for standard white cards. */
  variant?: 'dark' | 'light';
}

const PROVIDERS: { id: CloudProvider; label: string; pick: () => Promise<{ name: string; arrayBuffer: ArrayBuffer; mimeType: string } | null> }[] = [
  { id: 'google-drive', label: 'Google Drive', pick: pickFromGoogleDrive },
  { id: 'onedrive', label: 'OneDrive', pick: pickFromOneDrive },
  { id: 'dropbox', label: 'Dropbox', pick: pickFromDropbox },
];

/** Dropdown offering Google Drive / OneDrive / Dropbox import — normalises whatever the user picks into a plain File so existing upload handlers need zero changes. */
export const CloudImportMenu: React.FC<CloudImportMenuProps> = ({ onFileSelected, onError, disabled, variant = 'light' }) => {
  const [open, setOpen] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<CloudProvider | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // menuRef is checked separately from containerRef — the menu is portaled to
      // document.body (see render below), so it's no longer a DOM descendant of containerRef.
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Rendered via portal (see below) so a modal's own overflow-y-auto never clips this dropdown —
    // observed in practice: the "Увези од..." button sitting near the bottom of a scrollable modal
    // clipped the OneDrive/Google Drive/Dropbox options, forcing an extra scroll to reach them.
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setMenuPosition({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    };
    updatePosition();
    // Closing on scroll (rather than continuously repositioning) matches this menu's simple,
    // short-lived nature and avoids tracking every possible scrollable ancestor.
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  const handlePick = async (provider: typeof PROVIDERS[number]) => {
    setOpen(false);
    setLoadingProvider(provider.id);
    try {
      const result = await provider.pick();
      if (result) {
        onFileSelected(new File([result.arrayBuffer], result.name, { type: result.mimeType }));
      }
    } catch (err) {
      const message = err instanceof CloudImportError ? err.message : 'Увозот не успеа. Обидете се повторно.';
      onError?.(message);
    } finally {
      setLoadingProvider(null);
    }
  };

  const isDark = variant === 'dark';
  const buttonClass = isDark
    ? 'flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-50'
    : 'flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50';
  // Fixed (not absolute) — portaled to document.body below, positioned via inline style
  // computed from the trigger button's own screen position (menuPosition).
  const menuClass = isDark
    ? 'fixed z-[100] w-48 overflow-hidden rounded-xl border border-white/10 bg-[#1a1648] shadow-xl'
    : 'fixed z-[100] w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl';
  const itemClass = isDark
    ? 'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50'
    : 'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50';

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={disabled || loadingProvider !== null}
        className={buttonClass}
      >
        {loadingProvider ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
        Увези од...
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && menuPosition && createPortal(
        <div
          ref={menuRef}
          className={menuClass}
          style={{ top: menuPosition.top, left: menuPosition.left, minWidth: menuPosition.width }}
        >
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => handlePick(provider)}
              disabled={loadingProvider !== null}
              className={itemClass}
            >
              {provider.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};

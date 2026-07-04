import React, { useEffect, useRef, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
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
  const menuClass = isDark
    ? 'absolute z-20 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#1a1648] shadow-xl'
    : 'absolute z-20 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl';
  const itemClass = isDark
    ? 'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50'
    : 'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50';

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={disabled || loadingProvider !== null}
        className={buttonClass}
      >
        {loadingProvider ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
        Увези од...
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className={menuClass}>
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
        </div>
      )}
    </div>
  );
};

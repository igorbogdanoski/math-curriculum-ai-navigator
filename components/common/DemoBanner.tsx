/**
 * DemoBanner — shown when VITE_DEMO_MODE=true (read-only MON presentation environment).
 * Renders a persistent top bar indicating this is a demo instance.
 */

import React, { useState } from 'react';
import { MonitorPlay, X } from 'lucide-react';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

export const DemoBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (!IS_DEMO || dismissed) return null;

  return (
    <div
      role="banner"
      className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-sm font-medium flex items-center justify-center gap-3 px-4 py-2 shadow-md"
    >
      <MonitorPlay className="w-4 h-4 flex-shrink-0" />
      <span>
        <strong>Демо режим</strong> — Ова е презентациска верзија за МОН. Податоците се само за приказ.
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Затвори банер"
        className="ml-2 p-0.5 rounded hover:bg-amber-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

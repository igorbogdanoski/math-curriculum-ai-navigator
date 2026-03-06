import React from 'react';
import { create } from 'zustand';
import type { GeneratorState } from '../hooks/useGeneratorState';

/** Full GeneratorState fields can be passed to pre-populate the generator panel */
export type GeneratorPanelProps = Partial<GeneratorState>;

interface GeneratorPanelState {
  isOpen: boolean;
  props: GeneratorPanelProps | null;
  openGeneratorPanel: (props: GeneratorPanelProps) => void;
  closeGeneratorPanel: () => void;
}

// Track pending close timeout so it can be cancelled if the panel is reopened quickly
let _closeTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const useGeneratorPanel = create<GeneratorPanelState>((set) => ({
  isOpen: false,
  props: null,
  openGeneratorPanel: (panelProps) => {
    // Cancel any pending props-clear from a previous close animation
    if (_closeTimeoutId !== null) {
      clearTimeout(_closeTimeoutId);
      _closeTimeoutId = null;
    }
    set({ props: panelProps, isOpen: true });
  },
  closeGeneratorPanel: () => {
    set({ isOpen: false });
    // Allow for animation before clearing props
    _closeTimeoutId = setTimeout(() => {
      set({ props: null });
      _closeTimeoutId = null;
    }, 350);
  },
}));

export const GeneratorPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

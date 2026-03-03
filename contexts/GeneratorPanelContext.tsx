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

export const useGeneratorPanel = create<GeneratorPanelState>((set) => ({
  isOpen: false,
  props: null,
  openGeneratorPanel: (panelProps) => set({ props: panelProps, isOpen: true }),
  closeGeneratorPanel: () => {
    set({ isOpen: false });
    // Allow for animation before clearing props
    setTimeout(() => set({ props: null }), 300);
  },
}));

export const GeneratorPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

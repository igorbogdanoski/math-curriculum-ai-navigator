import React, { useState, createContext, useContext, useCallback, useMemo } from 'react';
import type { GenerationContextType, MaterialType } from '../types';

interface GeneratorPanelProps {
    grade?: string; 
    topicId?: string; 
    conceptId?: string;
    contextType?: GenerationContextType | 'ACTIVITY';
    scenario?: string;
    standardId?: string;
    materialType?: MaterialType;
}

interface GeneratorPanelContextType {
  isOpen: boolean;
  props: GeneratorPanelProps | null;
  openGeneratorPanel: (props: GeneratorPanelProps) => void;
  closeGeneratorPanel: () => void;
}

const GeneratorPanelContext = createContext<GeneratorPanelContextType | undefined>(undefined);

export const useGeneratorPanel = () => {
  const context = useContext(GeneratorPanelContext);
  if (!context) {
    throw new Error('useGeneratorPanel must be used within a GeneratorPanelProvider');
  }
  return context;
};

export const GeneratorPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [props, setProps] = useState<GeneratorPanelProps | null>(null);

  const openGeneratorPanel = useCallback((panelProps: GeneratorPanelProps) => {
    setProps(panelProps);
    setIsOpen(true);
  }, []);

  const closeGeneratorPanel = useCallback(() => {
    setIsOpen(false);
    // Allow for animation before clearing props
    setTimeout(() => setProps(null), 300);
  }, []);

  const value = useMemo(() => ({ isOpen, props, openGeneratorPanel, closeGeneratorPanel }), [isOpen, props, openGeneratorPanel, closeGeneratorPanel]);

  return (
    <GeneratorPanelContext.Provider value={value}>
      {children}
    </GeneratorPanelContext.Provider>
  );
};

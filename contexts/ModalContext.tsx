import React, { useState, createContext, useContext, useCallback, useMemo } from 'react';
import { ModalType } from '../types';

// NOTE: `<ModalManager />` is deliberately NOT rendered here — it is mounted
// once at the App root (App.tsx). That keeps this context file free of any
// import from components/common/ModalManager, which previously closed a
// 7-way circular dependency (ModalContext → ModalManager → each modal →
// useModal from ModalContext).

interface ModalState {
  type: ModalType;
  props?: Record<string, any>;
}

interface ModalContextType {
  showModal: (type: ModalType, props?: Record<string, any>) => void;
  hideModal: () => void;
  modal: ModalState | null;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<ModalState | null>(null);

  const showModal = useCallback((type: ModalType, props: Record<string, any> = {}) => {
    setModal({ type, props });
  }, []);

  const hideModal = useCallback(() => {
    setModal(null);
  }, []);

  const value = useMemo(() => ({ showModal, hideModal, modal }), [showModal, hideModal, modal]);

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};
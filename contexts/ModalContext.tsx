import React, { useState, createContext, useContext, useCallback } from 'react';
import { ModalManager } from '../components/common/ModalManager';
import { ModalType } from '../types';

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

  const value = { showModal, hideModal, modal };

  return (
    <ModalContext.Provider value={value}>
      {children}
      <ModalManager />
    </ModalContext.Provider>
  );
};
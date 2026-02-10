import React, { useEffect, useRef } from 'react';

interface ModalContainerProps {
  children: React.ReactNode;
  onClose?: () => void;
  title?: string;
}

/**
 * WCAG-compliant Modal Container
 * - Traps focus within the modal
 * - Closes on Escape key
 * - Restores focus when closed
 * - Prevents body scroll
 */
export const ModalContainer: React.FC<ModalContainerProps> = ({ children, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Store currently focused element
    previousFocus.current = document.activeElement as HTMLElement;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Initial focus - find first focusable or focus the container
    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      modalRef.current?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;

        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      // Restore focus
      if (previousFocus.current) {
        previousFocus.current.focus();
      }
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 md:p-10"
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" 
        onClick={onClose} 
        aria-hidden="true"
      />
      <div 
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
};

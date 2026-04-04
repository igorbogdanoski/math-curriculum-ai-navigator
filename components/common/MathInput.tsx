import React, { useEffect, useRef } from 'react';
import 'mathlive';


interface MathInputProps {
  value: string;
  onChange: (latex: string) => void;
  placeholder?: string;
  className?: string;
}

export const MathInput: React.FC<MathInputProps> = ({ 
  value, 
  onChange, 
  placeholder = 'Внеси математички израз...',
  className = '' 
}) => {
  // MathLive's MathFieldElement extends HTMLElement with .value and .setValue()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mfRef = useRef<any>(null);

  useEffect(() => {
    const mf = mfRef.current;
    if (mf) {
      if (mf.value !== value) {
        mf.setValue(value, { suppressChangeNotifications: true });
      }
      
      const handleChange = (ev: Event) => {
        onChange(mf.value);
      };
      
      mf.addEventListener('input', handleChange);
      return () => mf.removeEventListener('input', handleChange);
    }
  }, [onChange, value]);

  return (
    <div className={`p-3 border-2 border-indigo-100 rounded-xl focus-within:border-indigo-500 bg-white shadow-sm transition-all duration-200 min-h-[60px] flex items-center ${className}`}>
      {React.createElement('math-field', {
        ref: mfRef,
        'virtual-keyboard-mode': 'onfocus',
        placeholder,
        style: {
          width: '100%',
          fontSize: '1.25rem',
          outline: 'none',
          border: 'none',
          backgroundColor: 'transparent',
        },
      })}
    </div>
  );
};

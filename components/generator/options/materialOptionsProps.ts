import type { GeneratorState, GeneratorAction } from '../../../hooks/useGeneratorState';
import type { TeachingProfile, BloomDistribution } from '../../../types';
import React from 'react';

export interface MaterialOptionsProps {
  state: GeneratorState;
  dispatch: React.Dispatch<GeneratorAction>;
  user: TeachingProfile | null;
}

export const BLOOM_LEVELS: {
  key: keyof BloomDistribution;
  label: string;
  inactiveClass: string;
  activeClass: string;
}[] = [
  { key: 'Remembering',   label: 'Паметење',   inactiveClass: 'border-pink-300 text-pink-700',    activeClass: 'bg-pink-500 border-pink-500 text-white'   },
  { key: 'Understanding', label: 'Разбирање',  inactiveClass: 'border-orange-300 text-orange-700', activeClass: 'bg-orange-500 border-orange-500 text-white' },
  { key: 'Applying',      label: 'Примена',    inactiveClass: 'border-yellow-400 text-yellow-700', activeClass: 'bg-yellow-500 border-yellow-500 text-white' },
  { key: 'Analyzing',     label: 'Анализа',    inactiveClass: 'border-green-400 text-green-700',   activeClass: 'bg-green-500 border-green-500 text-white'  },
  { key: 'Evaluating',    label: 'Евалуација', inactiveClass: 'border-blue-400 text-blue-700',     activeClass: 'bg-blue-500 border-blue-500 text-white'   },
  { key: 'Creating',      label: 'Создавање',  inactiveClass: 'border-purple-400 text-purple-700', activeClass: 'bg-purple-500 border-purple-500 text-white' },
];



import React from 'react';
import { Card } from '../components/common/Card';
import { useNavigation } from '../contexts/NavigationContext';

export const NotFoundView: React.FC = () => {
  const { navigate } = useNavigation();
  return (
    <div className="p-8 text-center flex flex-col items-center justify-center h-full">
      <Card className="max-w-md">
        <h1 className="text-6xl font-bold text-brand-primary">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mt-4">Страницата не е пронајдена</h2>
        <p className="text-gray-600 mt-2">Страницата што ја барате не постои.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-6 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary transition-colors"
        >
          Врати се на почетна
        </button>
      </Card>
    </div>
  );
};
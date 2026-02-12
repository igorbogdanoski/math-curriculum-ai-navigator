import React, { useState, useEffect } from 'react';
import { firestoreService, type CachedMaterial } from '../../services/firestoreService';
import { Card } from './Card';
import { ICONS } from '../../constants';
import { MathRenderer } from './MathRenderer';
import { SkeletonLoader } from './SkeletonLoader';

interface CachedResourcesBrowserProps {
  conceptId: string;
  onSelect: (content: string) => void;
  type?: 'analogy' | 'outline' | 'quiz' | 'problems';
}

export const CachedResourcesBrowser: React.FC<CachedResourcesBrowserProps> = ({ conceptId, onSelect, type }) => {
  const [materials, setMaterials] = useState<CachedMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResources = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // We use the global fetch but filter locally for simplicity since firestoreService
        // currently doesn't have a concept-specific fetch. 
        // In a real production app, we would add a where('conceptId', '==', conceptId) query.
        const allCached = await firestoreService.fetchCachedMaterials(100);
        const filtered = allCached.filter(m => 
            m.conceptId === conceptId && (!type || m.type === type)
        );
        setMaterials(filtered);
      } catch (err) {
        setError('Неуспешно вчитување на библиотеката.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResources();
  }, [conceptId, type]);

  if (isLoading) {
    return <SkeletonLoader count={2} />;
  }

  if (error) {
    return <div className="text-red-500 text-xs p-2">{error}</div>;
  }

  if (materials.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 text-center">
        <ICONS.search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500 italic">Нема пронајдено претходно генерирани материјали за овој поим.</p>
        <p className="text-[10px] text-gray-400 mt-1">Бидете првиот што ќе генерира со AI!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <ICONS.explore className="w-4 h-4 text-brand-primary" />
          Пронајдени во библиотеката ({materials.length})
        </h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {materials.map((material) => (
          <div 
            key={material.id} 
            className="border border-gray-200 rounded-lg p-3 hover:border-brand-primary transition-all group relative bg-white"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold uppercase text-brand-accent bg-brand-accent/10 px-1.5 py-0.5 rounded">
                {material.type}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                 <ICONS.check className="w-3 h-3 text-green-500" /> {material.helpfulCount || 0}
              </div>
            </div>
            
            <div className="text-xs text-gray-600 line-clamp-4 mb-3 bg-gray-50 p-2 rounded max-h-24 overflow-hidden relative">
              <MathRenderer text={material.content} />
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-gray-50 to-transparent"></div>
            </div>

            <button 
              onClick={() => onSelect(material.content)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-brand-primary text-white text-xs font-semibold rounded hover:bg-brand-secondary transition-colors"
            >
              <ICONS.copy className="w-3.5 h-3.5" />
              Употреби го ова
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

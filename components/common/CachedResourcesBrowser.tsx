import React, { useState, useEffect } from 'react';
import { firestoreService, type CachedMaterial } from '../../services/firestoreService';
import { Card } from './Card';
import { ICONS } from '../../constants';
import { MathRenderer } from './MathRenderer';
import { SkeletonLoader } from './SkeletonLoader';
import { Search, Globe, Filter, Star } from 'lucide-react';

interface CachedResourcesBrowserProps {
  conceptId: string;
  onSelect: (content: any) => void;
  type?: 'analogy' | 'outline' | 'quiz' | 'problems' | 'solver' | 'ideas';
}

export const CachedResourcesBrowser: React.FC<CachedResourcesBrowserProps> = ({ conceptId, onSelect, type }) => {
  const [materials, setMaterials] = useState<CachedMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);

  useEffect(() => {
    const fetchResources = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch materials from global cache
        const allCached = await firestoreService.fetchCachedMaterials(100);
        
        let filtered = allCached;
        
        if (!isGlobal) {
          // Filter by current concept if not in global mode
          filtered = allCached.filter(m => m.conceptId === conceptId);
        }

        if (type) {
          // Filter by material type if provided
          filtered = filtered.filter(m => m.type === type);
        }

        setMaterials(filtered);
      } catch (err) {
        setError('Неуспешно вчитување на библиотеката.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResources();
  }, [conceptId, type, isGlobal]);

  const displayMaterials = materials.filter(m => {
    if (!searchTerm) return true;
    const contentStr = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    return contentStr.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (isLoading) {
    return <SkeletonLoader count={2} />;
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Header */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Пребарај низ архивата..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm focus:border-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsGlobal(!isGlobal)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${isGlobal ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-800 text-gray-400 border border-slate-700'}`}
          >
            <Globe className="w-3.5 h-3.5" />
            ГЛОБАЛНА АРХИВА
          </button>
          <div className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-[10px] font-black text-blue-400 uppercase tracking-widest">
            {displayMaterials.length} РЕЗУЛТАТИ
          </div>
        </div>
      </div>

      {error && <div className="text-red-400 text-[10px] p-2 bg-red-400/10 rounded-lg border border-red-400/20">{error}</div>}

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {displayMaterials.length === 0 ? (
          <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-2xl p-8 text-center">
            <Filter className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 italic">Нема пронајдено материјали.</p>
            <button 
              onClick={() => {setSearchTerm(''); setIsGlobal(true);}}
              className="text-xs text-blue-400 font-bold mt-2 hover:underline"
            >
              Прикажи ја целата архива
            </button>
          </div>
        ) : (
          displayMaterials.map((material) => (
            <div 
              key={material.id} 
              className="group border border-slate-700 rounded-2xl p-4 hover:border-blue-500/50 transition-all bg-slate-800/40 relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md border border-blue-400/20">
                    {material.type}
                  </span>
                  {material.helpfulCount && material.helpfulCount > 0 && (
                    <div className="flex items-center gap-1 text-[9px] font-black text-yellow-500">
                      <Star className="w-2.5 h-2.5 fill-yellow-500" /> {material.helpfulCount}
                    </div>
                  )}
                </div>
                <span className="text-[8px] text-gray-500 font-mono">
                  {new Date(material.timestamp).toLocaleDateString('mk-MK')}
                </span>
              </div>
              
              <div className="text-xs text-gray-300 line-clamp-3 mb-4 leading-relaxed italic opacity-80 group-hover:opacity-100 transition-opacity">
                {typeof material.content === 'string' ? (
                  <MathRenderer text={material.content} />
                ) : (
                  <span>[Интерактивен Материјал: {material.content.title || 'Квиз/Задача'}]</span>
                )}
              </div>

              <button 
                onClick={() => onSelect(material.content)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600/10 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-400/20 hover:bg-blue-600 hover:text-white transition-all active:scale-95"
              >
                <ICONS.copy className="w-3 h-3" />
                Употреби
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

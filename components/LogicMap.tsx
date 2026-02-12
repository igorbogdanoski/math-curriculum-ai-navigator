import React from 'react';
import { GitBranch, Target } from 'lucide-react';

export const LogicMap = ({ mapData }: { mapData: any }) => {
  return (
    <div className="bg-slate-900 p-6 rounded-2xl my-6 border-2 border-slate-700">
      <h4 className="text-slate-400 text-xs font-bold uppercase mb-4 flex items-center gap-2">
        <GitBranch className="w-4 h-4" /> Архитектура на решението
      </h4>
      <div className="flex flex-col items-center gap-4">
        {mapData.nodes.map((node: any, idx: number) => (
          <React.Fragment key={node.id}>
            <div className={`p-3 rounded-lg border-2 text-sm font-medium ${
              idx === 0 ? 'bg-blue-900/40 border-blue-500 text-blue-100' : 
              idx === mapData.nodes.length - 1 ? 'bg-green-900/40 border-green-500 text-green-100' :
              'bg-slate-800 border-slate-600 text-slate-300'
            }`}>
              {node.label}
            </div>
            {idx < mapData.nodes.length - 1 && (
              <div className="h-6 w-0.5 bg-slate-700 relative">
                <div className="absolute -bottom-1 -left-1 text-slate-700 text-[10px]">▼</div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

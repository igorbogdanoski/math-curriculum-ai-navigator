import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { useNavigation } from '../contexts/NavigationContext';
import { ICONS } from '../constants';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import type { Concept, NationalStandard } from '../types';

declare global {
  interface Window {
    vis: any;
  }
}

interface MindMapViewProps {
  topicId: string;
}

const wrapText = (text: string, maxWidth: number = 25) => {
    const words = text.split(' ');
    let line = '';
    let result = '';
    for (const word of words) {
        if ((line + word).length > maxWidth) {
            result += line.trim() + '\n';
            line = '';
        }
        line += word + ' ';
    }
    result += line.trim();
    return result;
};


const createMindMapTooltip = (header: string, content: string, headerColor: string = '#0D47A1'): HTMLElement => {
   const container = document.createElement('div');
   container.style.padding = '8px';
   container.style.maxWidth = '250px';
   container.style.fontFamily = 'sans-serif';
   container.style.backgroundColor = 'white';
   container.style.borderRadius = '4px';
   container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
   
   const titleDiv = document.createElement('div');
   titleDiv.style.fontWeight = 'bold';
   titleDiv.style.marginBottom = '4px';
   titleDiv.style.color = headerColor;
   titleDiv.style.fontSize = '1.05em';
   titleDiv.style.borderBottom = `1px solid ${headerColor}40`;
   titleDiv.style.paddingBottom = '4px';
   titleDiv.textContent = header;
   
   const bodyDiv = document.createElement('div');
   bodyDiv.style.fontSize = '0.9em';
   bodyDiv.style.color = '#333';
   bodyDiv.textContent = content;
   
   container.appendChild(titleDiv);
   container.appendChild(bodyDiv);
   return container;
};

export const MindMapView: React.FC<MindMapViewProps> = ({ topicId }) => {
  const graphRef = useRef<HTMLDivElement>(null);
  const { navigate } = useNavigation();
  const { getTopic, getConceptDetails, getStandardsByIds, isLoading } = useCurriculum();
  const networkRef = useRef<any>(null);

  const { topic } = useMemo(() => getTopic(topicId), [getTopic, topicId]);

  // View Controls
  const [showActivities, setShowActivities] = useState(true);
  const [showStandards, setShowStandards] = useState(true); // National & Assessment
  const [showPriorKnowledge, setShowPriorKnowledge] = useState(true);

  const { nodes, edges } = useMemo(() => {
    if (!topic) return { nodes: [], edges: [] };

    let nodes: any[] = [];
    let edges: any[] = [];
    
    // 1. Central Topic Node
    const topicTooltip = `
      <div style="font-family:sans-serif; max-width:300px; padding:4px;">
        <div style="font-weight:bold; font-size:1.1em; margin-bottom:6px; color:#0D47A1;">${topic.title}</div>
        ${topic.description ? `<div style="margin-bottom:8px; font-size:0.9em;">${topic.description}</div>` : ''}
        ${topic.topicLearningOutcomes && topic.topicLearningOutcomes.length > 0 ? 
          `<div style="font-weight:bold; border-top:1px solid #ddd; padding-top:6px; margin-top:6px; font-size:0.85em; color:#333;">Резултати од учење:</div>
           <ul style="padding-left:16px; margin:4px 0; font-size:0.85em; color:#444;">${topic.topicLearningOutcomes.map((o: string) => `<li>${o}</li>`).join('')}</ul>`
          : ''}
      </div>
    `;

    nodes.push({
      id: topic.id,
      label: topic.title,
      shape: 'star',
      color: '#0D47A1', // brand-primary
      font: { color: 'white', size: 18 },
      fixed: true,
      title: topicTooltip
    });

    // 2. Concept Nodes (Main branches)
    topic.concepts?.forEach((concept: Concept) => {
      nodes.push({
        id: concept.id,
        label: concept.title,
        shape: 'box',
        color: '#1976D2', // brand-secondary
        font: { color: 'white' },
        title: createMindMapTooltip(concept.title, concept.description, '#0D47A1')
      });
      edges.push({ from: topic.id, to: concept.id, length: 200 });

      // 3. Sub-branch nodes for each concept
      // Prior Knowledge
      if (showPriorKnowledge) {
          concept.priorKnowledgeIds?.forEach((pkId: string) => {
            const { concept: pkConcept } = getConceptDetails(pkId);
            if (pkConcept) {
              const id = `${concept.id}-pk-${pkConcept.id}`; 
              nodes.push({
                id: id, 
                _realId: pkConcept.id, // For navigation
                label: wrapText(pkConcept.title),
                shape: 'ellipse',
                color: '#FF9800', // Orange
                font: { size: 10 },
                title: createMindMapTooltip('Предзнаење:', pkConcept.title, '#EF6C00')
              });
              edges.push({ from: concept.id, to: id, length: 150 });
            }
          });
      }
      
      // Standards (Assessment & National)
      if (showStandards) {
          if (concept.assessmentStandards) {
            concept.assessmentStandards.forEach((std: string, j: number) => {
              const id = `${concept.id}-as-${j}`;
              nodes.push({ id, _realId: concept.id, label: wrapText(std), shape: 'dot', color: '#4CAF50', size: 10, title: createMindMapTooltip('Стандард за оценување:', std, '#2E7D32') });
              edges.push({ from: concept.id, to: id });
            });
          }

          if (concept.nationalStandardIds) {
            getStandardsByIds(concept.nationalStandardIds).forEach((std: NationalStandard, j: number) => {
                const id = `${concept.id}-ns-${j}`;
                nodes.push({ id, _realId: concept.id, label: std.code, shape: 'dot', color: '#F44336', size: 10, title: createMindMapTooltip(`Национален стандард (${std.code}):`, std.description, '#C62828') });
                edges.push({ from: concept.id, to: id });
            });
          }
      }

      // Activities
      if (showActivities) {
          concept.activities?.forEach((act: string, j: number) => {
            const id = `${concept.id}-act-${j}`;
            nodes.push({ id, _realId: concept.id, label: wrapText(act, 15), shape: 'dot', color: '#9C27B0', size: 10, title: createMindMapTooltip('Активност:', act, '#7B1FA2') });
            edges.push({ from: concept.id, to: id });
          });
      }

    });

    // Remove duplicate nodes (e.g., if a concept is prior knowledge for multiple other concepts)
    const uniqueNodes = Array.from(new Map(nodes.map(node => [node.id, node])).values());

    return { nodes: uniqueNodes, edges };
  }, [topic, getConceptDetails, getStandardsByIds, showActivities, showStandards, showPriorKnowledge]);

  useEffect(() => {
    if (graphRef.current && window.vis && !isLoading && nodes.length > 0) {
      const data = { nodes, edges };
      const options = {
        nodes: {
            borderWidth: 2,
            font: {
                multi: 'html'
            }
        },
        edges: {
          color: { inherit: 'from' },
          smooth: true,
          arrows: { to: { enabled: false } },
        },
        physics: {
          barnesHut: {
            gravitationalConstant: -20000,
            centralGravity: 0.3,
            springLength: 150,
            springConstant: 0.05,
            damping: 0.09,
          },
          minVelocity: 0.75,
        },
        interaction: {
          tooltipDelay: 100,
          dragNodes: true,
          dragView: true,
          zoomView: true,
        },
      };

      const network = new window.vis.Network(graphRef.current, data, options);
      networkRef.current = network;

      network.on('doubleClick', (params: any) => {
        const nodeId = params.nodes[0];
        if (!nodeId) return;
        
        // Find the node object to check properties
        const nodeObj = nodes.find((n: any) => n.id === nodeId);
        
        // Navigate if it's a concept node.
        // Resolve target ID (handling Prior Knowledge nodes which have _realId)
        const targetId = nodeObj?._realId || nodeId;
        
        if (targetId) {
            const safeId = String(targetId).trim();
            // Basic validation: ensure ID looks like a concept ID (starts with 'g' or is known format)
            if (safeId.startsWith('g')) {
                navigate(`/concept/${encodeURIComponent(safeId)}`);
            } else {
                console.warn(`[MindMap] Ignored navigation to non-concept node: ${safeId}`);
            }
        }
      });

      return () => {
        if (network) {
          network.destroy();
          networkRef.current = null;
        }
      };
    }
  }, [nodes, edges, navigate, isLoading]);

  const handleExport = () => {
    if (networkRef.current && graphRef.current) {
        const canvas = graphRef.current.querySelector('canvas');
        if (canvas) {
            const dataURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `${topic?.title || 'mind-map'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
  };


  if (isLoading || !topic) {
    return (
      <div className="p-8"><SkeletonLoader type="paragraph" /></div>
    );
  }

  return (
    <div className="p-8 animate-fade-in">
      <header className="mb-6">
        <div className="flex justify-between items-center mb-4">
            <div>
                <h1 className="text-4xl font-bold text-brand-primary">Мисловна Мапа: {topic.title}</h1>
                <p className="text-lg text-gray-600 mt-2">Двоен-клик на поим за да видите детали.</p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => navigate(`/topic/${topicId}`)} className="flex items-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">
                    <ICONS.chevronRight className="w-5 h-5 rotate-180" /> Назад кон темата
                </button>
                <button onClick={handleExport} className="flex items-center gap-2 bg-brand-secondary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-primary">
                    <ICONS.download className="w-5 h-5" /> Сними како слика
                </button>
            </div>
        </div>
        
        {/* View Controls */}
        <div className="flex flex-wrap gap-4 p-2 bg-gray-50 rounded-lg border border-gray-200 items-center">
            <span className="text-sm font-semibold text-gray-700 px-2 border-r border-gray-300">Филтрирај приказ:</span>
            
            <label className="flex items-center space-x-2 cursor-pointer select-none hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                <input 
                    type="checkbox" 
                    checked={showPriorKnowledge} 
                    onChange={e => setShowPriorKnowledge(e.target.checked)} 
                    className="rounded text-brand-primary focus:ring-brand-primary w-4 h-4" 
                />
                <span className="text-sm text-gray-700 flex items-center gap-1.5 font-medium">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF9800]"></div> Предзнаења
                </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                <input 
                    type="checkbox" 
                    checked={showStandards} 
                    onChange={e => setShowStandards(e.target.checked)} 
                    className="rounded text-brand-primary focus:ring-brand-primary w-4 h-4" 
                />
                <span className="text-sm text-gray-700 flex items-center gap-1.5 font-medium">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#4CAF50] to-[#F44336]"></div> Стандарди
                </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none hover:bg-gray-100 px-2 py-1 rounded transition-colors">
                <input 
                    type="checkbox" 
                    checked={showActivities} 
                    onChange={e => setShowActivities(e.target.checked)} 
                    className="rounded text-brand-primary focus:ring-brand-primary w-4 h-4" 
                />
                <span className="text-sm text-gray-700 flex items-center gap-1.5 font-medium">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#9C27B0]"></div> Активности
                </span>
            </label>
            
            <span className="text-xs text-gray-500 ml-auto hidden md:block italic">
                (Користи го тркалцето на глувчето за зумирање)
            </span>
        </div>
      </header>
      <Card className="p-2 relative">
         <div ref={graphRef} style={{ height: '75vh', width: '100%' }} />
         <div className="absolute bottom-4 left-4 bg-white/80 p-2 rounded-md border text-xs space-y-1">
            <h4 className="font-bold mb-1">Легенда:</h4>
            <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#1976D2] mr-2"></div>Поим</div>
            <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#FF9800] mr-2"></div>Предзнаење</div>
            <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#4CAF50] mr-2"></div>Стандард за оценување</div>
            <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#F44336] mr-2"></div>Национален стандард</div>
            <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#9C27B0] mr-2"></div>Активност</div>
         </div>
      </Card>
    </div>
  );
};

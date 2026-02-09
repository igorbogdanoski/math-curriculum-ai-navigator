import React, { useEffect, useRef, useMemo } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { useNavigation } from '../contexts/NavigationContext';
import { ICONS } from '../constants';
import { SkeletonLoader } from '../components/common/SkeletonLoader';

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


export const MindMapView: React.FC<MindMapViewProps> = ({ topicId }) => {
  const graphRef = useRef<HTMLDivElement>(null);
  const { navigate } = useNavigation();
  const { getTopic, getConceptDetails, getStandardsByIds, isLoading } = useCurriculum();
  const networkRef = useRef<any>(null);

  const { topic } = useMemo(() => getTopic(topicId), [getTopic, topicId]);

  const { nodes, edges } = useMemo(() => {
    if (!topic) return { nodes: [], edges: [] };

    let nodes: any[] = [];
    let edges: any[] = [];
    
    // 1. Central Topic Node
    nodes.push({
      id: topic.id,
      label: topic.title,
      shape: 'star',
      color: '#0D47A1', // brand-primary
      font: { color: 'white', size: 18 },
      fixed: true,
    });

    // 2. Concept Nodes (Main branches)
    topic.concepts.forEach((concept, i) => {
      nodes.push({
        id: concept.id,
        label: concept.title,
        shape: 'box',
        color: '#1976D2', // brand-secondary
        font: { color: 'white' },
        title: `<b>${concept.title}</b><br>${concept.description}`
      });
      edges.push({ from: topic.id, to: concept.id, length: 200 });

      // 3. Sub-branch nodes for each concept
      // Prior Knowledge
      concept.priorKnowledgeIds.forEach(pkId => {
        const { concept: pkConcept } = getConceptDetails(pkId);
        if (pkConcept) {
          nodes.push({
            id: pkConcept.id, // Use original ID to allow navigation
            label: wrapText(pkConcept.title),
            shape: 'ellipse',
            color: '#FF9800', // Orange
            font: { size: 10 },
            title: `<b>Предзнаење:</b><br>${pkConcept.title}`
          });
          edges.push({ from: concept.id, to: pkConcept.id, length: 150 });
        }
      });
      
      // Assessment Standards
      concept.assessmentStandards.forEach((std, j) => {
        const id = `${concept.id}-as-${j}`;
        nodes.push({ id, label: wrapText(std), shape: 'dot', color: '#4CAF50', size: 10, title: `<b>Стандард за оценување:</b><br>${std}` });
        edges.push({ from: concept.id, to: id });
      });

      // National Standards
      getStandardsByIds(concept.nationalStandardIds).forEach((std, j) => {
          const id = `${concept.id}-ns-${j}`;
          nodes.push({ id, label: std.code, shape: 'dot', color: '#F44336', size: 10, title: `<b>Национален стандард:</b><br>${std.code}: ${std.description}` });
          edges.push({ from: concept.id, to: id });
      });

      // Activities
      concept.activities?.forEach((act, j) => {
        const id = `${concept.id}-act-${j}`;
        nodes.push({ id, label: wrapText(act, 15), shape: 'dot', color: '#9C27B0', size: 10, title: `<b>Активност:</b><br>${act}` });
        edges.push({ from: concept.id, to: id });
      });

    });

    // Remove duplicate nodes (e.g., if a concept is prior knowledge for multiple other concepts)
    const uniqueNodes = Array.from(new Map(nodes.map(node => [node.id, node])).values());

    return { nodes: uniqueNodes, edges };
  }, [topic, getConceptDetails, getStandardsByIds]);

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
        // Navigate only if a concept node is clicked (IDs start with 'g')
        if (nodeId && String(nodeId).startsWith('g')) {
          navigate(`/concept/${nodeId}`);
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
      <header className="mb-6 flex justify-between items-center">
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

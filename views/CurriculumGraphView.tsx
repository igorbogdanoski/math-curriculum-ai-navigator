import { logger } from '../utils/logger';
import { loadScript } from '../utils/loadScript';

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { useNavigation } from '../contexts/NavigationContext';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import type { Grade, Topic } from '../types';

import {
    MASTERY_COLORS, FOCUS_COLOR, PRIOR_COLOR, FUTURE_COLOR,
    GRADE_COLORS, matchStrand, getRomanGrade,
    createTooltipElement, createClusterTooltip,
} from './curriculumGraph/graphUtils';
import type { MenuState, EnrichedConcept } from './curriculumGraph/graphUtils';
import { GraphToolbar } from './curriculumGraph/GraphToolbar';
import { GraphLegend } from './curriculumGraph/GraphLegend';
import { GraphContextMenu } from './curriculumGraph/GraphContextMenu';
import { GraphAiPanel } from './curriculumGraph/GraphAiPanel';

declare global {
  interface Window { vis: any; }
}

const CANVAS_BG       = '#ffffff';
const EDGE_DEFAULT_COLOR = '#9E9E9E';
const EDGE_GLOBAL_COLOR  = '#BDBDBD';

export const CurriculumGraphView: React.FC = () => {
  const graphRef   = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);
  const nodesRef   = useRef<any[]>([]);

  const { navigate }          = useNavigation();
  const { openGeneratorPanel }= useGeneratorPanel();
  const { allConcepts, isLoading, curriculum } = useCurriculum();
  const { firebaseUser, user } = useAuth();

  const [showMasteryOverlay, setShowMasteryOverlay] = useState(false);
  const [avgMastery, setAvgMastery]   = useState<Record<string, number>>({});
  const [masteryLoading, setMasteryLoading] = useState(false);

  const defaultGrades = useMemo(() => {
    if (!user?.secondaryTrack || !curriculum) return [6];
    const trackGrades = curriculum.grades
      .filter((g: Grade) => g.secondaryTrack === user.secondaryTrack)
      .map((g: Grade) => g.level);
    return trackGrades.length > 0 ? [trackGrades[0]] : [6];
  }, [user?.secondaryTrack, curriculum]);

  const [selectedGrades, setSelectedGrades] = useState<number[]>([6]);
  useEffect(() => { if (defaultGrades.length > 0) setSelectedGrades(defaultGrades); }, [defaultGrades]);

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isClustered,    setIsClustered]    = useState(false);
  const [isFullscreen,   setIsFullscreen]   = useState(false);
  const [aiAnalysisConcept, setAiAnalysisConcept] = useState<EnrichedConcept | null>(null);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState<EnrichedConcept[]>([]);
  const [layoutMode, setLayoutMode] = useState<'organic' | 'hierarchical'>('hierarchical');
  const [selectedStrand, setSelectedStrand] = useState<string | null>(null);
  const [focusNodeId,    setFocusNodeId]    = useState<string | null>(null);
  const [menuState, setMenuState] = useState<MenuState>({
    x: 0, y: 0, nodeId: '', label: '', visible: false, gradeLevel: 0, topicId: '', isCluster: false,
  });

  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    bloomLevel: string; bloomDetails: string; misconceptions: string[];
    pedagogicalBridge: string; diagnosticQuestion: string;
  } | null>(null);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

  // Load mastery data when overlay toggled on
  useEffect(() => {
    if (!showMasteryOverlay || !firebaseUser?.uid) return;
    setMasteryLoading(true);
    firestoreService.fetchQuizResults(500, firebaseUser.uid)
      .then(results => {
        const sums: Record<string, number> = {};
        const counts: Record<string, number> = {};
        for (const r of results) {
          if (!r.conceptId) continue;
          sums[r.conceptId]   = (sums[r.conceptId]   ?? 0) + r.percentage;
          counts[r.conceptId] = (counts[r.conceptId] ?? 0) + 1;
        }
        const avgs: Record<string, number> = {};
        for (const cid of Object.keys(sums)) avgs[cid] = Math.round(sums[cid] / counts[cid]);
        setAvgMastery(avgs);
      })
      .catch(() => { /* overlay shows no-data colors */ })
      .finally(() => setMasteryLoading(false));
  }, [showMasteryOverlay, firebaseUser?.uid]);

  const groupedTopics = useMemo(() => {
    if (!curriculum) return [];
    return curriculum.grades
      .filter((grade: Grade) => selectedGrades.includes(grade.level))
      .map((grade: Grade) => ({ gradeLevel: grade.level, gradeTitle: grade.title, topics: grade.topics || [] }));
  }, [curriculum, selectedGrades]);

  useEffect(() => {
    if (!focusNodeId) {
      setSelectedTopics(groupedTopics.flatMap((group: { topics: Topic[] }) => (group.topics || []).map((t: Topic) => t.id)));
    }
  }, [groupedTopics, focusNodeId]);

  useEffect(() => {
    if (searchQuery.trim().length > 1 && allConcepts) {
      setSearchResults(allConcepts.filter((c: EnrichedConcept) => c.title.toLowerCase().includes(searchQuery.toLowerCase())));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, allConcepts]);

  const handleExportImage = () => {
    if (!graphRef.current) return;
    const canvas = graphRef.current.querySelector('canvas');
    if (canvas) {
      const temp = document.createElement('canvas');
      temp.width  = canvas.width;
      temp.height = canvas.height;
      const ctx = temp.getContext('2d');
      if (ctx) {
        ctx.fillStyle = CANVAS_BG;
        ctx.fillRect(0, 0, temp.width, temp.height);
        ctx.drawImage(canvas, 0, 0);
        const a = document.createElement('a');
        a.href     = temp.toDataURL('image/png');
        a.download = 'curriculum-graph.png';
        a.click();
      }
    }
  };

  const handleSearchSelect = (conceptId: string) => {
    setFocusNodeId(conceptId);
    setSearchQuery('');
    setSearchResults([]);
    setIsClustered(false);
  };

  const { nodes, edges } = useMemo(() => {
    if (!allConcepts) return { nodes: [], edges: [] };

    const activeConceptIds = new Set<string>();
    const upstreamNodes   = new Set<string>();
    const downstreamNodes = new Set<string>();

    if (focusNodeId) {
      const childrenMap = new Map<string, string[]>();
      const parentMap   = new Map<string, string[]>();
      allConcepts.forEach((c: EnrichedConcept) => {
        parentMap.set(c.id, c.priorKnowledgeIds || []);
        c.priorKnowledgeIds?.forEach((pkId: string) => {
          if (!childrenMap.has(pkId)) childrenMap.set(pkId, []);
          childrenMap.get(pkId)?.push(c.id);
        });
      });
      const traceUp   = (id: string) => { (parentMap.get(id) || []).forEach(pid => { if (!upstreamNodes.has(pid) && pid !== focusNodeId) { upstreamNodes.add(pid); activeConceptIds.add(pid); traceUp(pid); } }); };
      const traceDown = (id: string) => { (childrenMap.get(id) || []).forEach(cid => { if (!downstreamNodes.has(cid) && cid !== focusNodeId) { downstreamNodes.add(cid); activeConceptIds.add(cid); traceDown(cid); } }); };
      activeConceptIds.add(focusNodeId);
      traceUp(focusNodeId);
      traceDown(focusNodeId);
    } else {
      allConcepts.forEach((concept: EnrichedConcept) => {
        if (selectedGrades.includes(concept.gradeLevel) && matchStrand(concept, selectedStrand)) {
          activeConceptIds.add(concept.id);
        }
      });
    }

    const nodesData = allConcepts
      .filter((c: EnrichedConcept) => activeConceptIds.has(c.id))
      .map((concept: EnrichedConcept) => {
        const isFocused = concept.id === focusNodeId;
        let nodeColor = GRADE_COLORS[concept.gradeLevel] || '#9E9E9E';

        if (showMasteryOverlay && !focusNodeId) {
          const score = avgMastery[concept.id];
          if (score === undefined)  nodeColor = MASTERY_COLORS.noData;
          else if (score >= 85)     nodeColor = MASTERY_COLORS.mastered;
          else if (score >= 70)     nodeColor = MASTERY_COLORS.passing;
          else if (score >= 50)     nodeColor = MASTERY_COLORS.developing;
          else                      nodeColor = MASTERY_COLORS.struggling;
        } else if (focusNodeId) {
          if (isFocused)                            nodeColor = FOCUS_COLOR;
          else if (upstreamNodes.has(concept.id))   nodeColor = PRIOR_COLOR;
          else if (downstreamNodes.has(concept.id)) nodeColor = FUTURE_COLOR;
        }

        const grade = curriculum?.grades.find((g: Grade) => g.level === concept.gradeLevel);
        const topic = grade?.topics.find((t: Topic) => t.id === concept.topicId);
        return {
          id: concept.id,
          label: concept.title.replace(/Вовед во |Операции со |Основи на /i, ''),
          title: createTooltipElement(concept.title, concept.description),
          level: concept.gradeLevel,
          color: nodeColor,
          font: { color: 'white', size: isFocused ? 18 : 14, face: 'Inter' },
          shape: 'box',
          borderWidth: isFocused ? 3 : 1,
          shadow: true,
          _fullLabel: concept.title,
          _gradeLevel: concept.gradeLevel,
          _topicId: concept.topicId,
          _topicTitle: topic?.title || 'Општо',
        };
      });

    const edgesData = allConcepts.flatMap((concept: EnrichedConcept) => {
      const priors = Array.isArray(concept.priorKnowledgeIds) ? concept.priorKnowledgeIds : [];
      return priors.map((priorId: string) => {
        if (!activeConceptIds.has(concept.id) || !activeConceptIds.has(priorId)) return null;
        let edgeColor = EDGE_DEFAULT_COLOR;
        let edgeWidth = 2;
        if (focusNodeId) {
          const isUp   = (upstreamNodes.has(priorId)   || priorId   === focusNodeId) && (upstreamNodes.has(concept.id)   || concept.id === focusNodeId);
          const isDown = (downstreamNodes.has(priorId) || priorId   === focusNodeId) && (downstreamNodes.has(concept.id) || concept.id === focusNodeId);
          if (isUp)   { edgeColor = PRIOR_COLOR;  edgeWidth = 4; }
          if (isDown) { edgeColor = FUTURE_COLOR; edgeWidth = 4; }
        }
        return { from: priorId, to: concept.id, arrows: 'to', width: edgeWidth, color: edgeColor, opacity: 1 };
      });
    }).filter(Boolean);

    return { nodes: nodesData, edges: edgesData };
  }, [allConcepts, selectedGrades, focusNodeId, curriculum, selectedStrand, showMasteryOverlay, avgMastery]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // Cluster management
  useEffect(() => {
    if (!networkRef.current || nodes.length === 0) return;
    const network = networkRef.current;
    network.setData({ nodes, edges });
    if (isClustered) {
      const topicsInView = new Set(nodes.map((n: any) => n._topicId));
      topicsInView.forEach(topicId => {
        const topicNodes = nodes.filter((n: any) => n._topicId === topicId);
        if (!topicNodes?.length) return;
        const { _topicTitle: topicTitle = 'Тема', _gradeLevel: gradeLevel = 0 } = topicNodes[0];
        const romanGrade    = getRomanGrade(gradeLevel);
        const color         = GRADE_COLORS[gradeLevel];
        const conceptLabels = topicNodes.map((n: any) => n._fullLabel || n.label);
        const previewItems  = conceptLabels.slice(0, 10);
        const titleLabel    = `[${romanGrade}] ${topicTitle}`;
        network.cluster({
          joinCondition: (nodeOptions: any) => nodeOptions._topicId === topicId,
          clusterNodeProperties: {
            id: `cluster:${topicId}`,
            label: `[${romanGrade}] ${topicTitle}\n(${topicNodes.length} поими)`,
            title: createClusterTooltip(titleLabel, previewItems, conceptLabels.length, color),
            color, shape: 'hexagon', size: 40, borderWidth: 2,
            font: { size: 16, color: 'white', bold: true, multi: true },
            allowSingleNodeCluster: true,
            level: gradeLevel, _isCluster: true, _topicId: topicId, _gradeLevel: gradeLevel,
          },
        });
      });
    }
  }, [isClustered, nodes, edges]);

  // Layout mode changes
  useEffect(() => {
    if (!networkRef.current) return;
    networkRef.current.setOptions({
      layout: {
        hierarchical: layoutMode === 'hierarchical' ? {
          enabled: true, direction: 'LR', sortMethod: 'directed',
          levelSeparation: 250, nodeSpacing: 100, treeSpacing: 200,
          blockShifting: true, edgeMinimization: true, parentCentralization: true,
        } : { enabled: false },
      },
      physics: layoutMode === 'hierarchical' ? { enabled: false } : {
        barnesHut: { gravitationalConstant: -20000, centralGravity: 0.3, springLength: 150, springConstant: 0.05, damping: 0.09, avoidOverlap: 0.5 },
        minVelocity: 0.75, stabilization: { enabled: true, iterations: 1000 },
      },
    });
    setTimeout(() => networkRef.current.fit({ animation: true }), 500);
  }, [layoutMode]);

  // vis.js initialization
  useEffect(() => {
    if (!graphRef.current || isLoading) return;
    loadScript('https://unpkg.com/vis-network/standalone/umd/vis-network.min.js').then(() => {
      if (!graphRef.current || networkRef.current) return;
      let network: any;
      try {
        network = new window.vis.Network(graphRef.current, { nodes, edges }, {
          nodes:  { shape: 'box', margin: 12, widthConstraint: { maximum: 220 } },
          edges:  { color: EDGE_GLOBAL_COLOR, smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.4 } },
          layout: { hierarchical: { enabled: true, direction: 'LR', sortMethod: 'directed', levelSeparation: 250, nodeSpacing: 200, treeSpacing: 250, blockShifting: true, edgeMinimization: true, parentCentralization: true, shakeTowards: 'leaves' } },
          physics: { enabled: false, hierarchicalRepulsion: { centralGravity: 0.0, springLength: 100, springConstant: 0.01, nodeDistance: 120, damping: 0.09 } },
          interaction: { dragNodes: true, dragView: true, zoomView: true, navigationButtons: true, keyboard: true, tooltipDelay: 200, hover: true, selectable: true },
        });
      } catch (err) {
        logger.error('[CurriculumGraph] vis.js Network init failed:', err);
        return;
      }
      networkRef.current = network;

      network.on('click', (params: any) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          if (network.isCluster(nodeId)) { network.openCluster(nodeId); return; }
          setFocusNodeId(nodeId);
          setIsClustered(false);
          const nodeData = nodesRef.current.find((n: any) => n.id === nodeId);
          if (nodeData) {
            setMenuState({ x: params.pointer.DOM.x, y: params.pointer.DOM.y, nodeId, label: nodeData._fullLabel || nodeData.label, gradeLevel: nodeData._gradeLevel, topicId: nodeData._topicId, visible: true, isCluster: false });
          }
        } else {
          setMenuState(prev => ({ ...prev, visible: false }));
        }
      });
      network.on('dragStart', () => setMenuState(prev => ({ ...prev, visible: false })));
      network.on('hoverNode', () => { if (graphRef.current) graphRef.current.style.cursor = 'pointer'; });
      network.on('blurNode',  () => { if (graphRef.current) graphRef.current.style.cursor = 'default'; });
      network.on('doubleClick', (params: any) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          if (network.isCluster(nodeId)) { network.openCluster(nodeId); }
          else if (String(nodeId).startsWith('g')) { navigate(`/concept/${nodeId}`); }
        }
      });
    }).catch(() => {});
  }, [isLoading, navigate]);

  useEffect(() => {
    return () => { if (networkRef.current) { networkRef.current.destroy(); networkRef.current = null; } };
  }, []);

  const handleViewConcept = () => { if (menuState.nodeId) navigate(`/concept/${menuState.nodeId}`); };

  const handleGenerateTest = () => {
    if (!menuState.nodeId) return;
    openGeneratorPanel({ selectedGrade: `grade-${menuState.gradeLevel}`, selectedTopic: menuState.topicId, selectedConcepts: [menuState.nodeId], contextType: 'CONCEPT', materialType: 'ASSESSMENT' });
    setMenuState(prev => ({ ...prev, visible: false }));
  };

  const handleGenerateIdeas = () => {
    if (!menuState.nodeId) return;
    openGeneratorPanel({ selectedGrade: `grade-${menuState.gradeLevel}`, selectedTopic: menuState.topicId, selectedConcepts: [menuState.nodeId], contextType: 'CONCEPT', materialType: 'SCENARIO' });
    setMenuState(prev => ({ ...prev, visible: false }));
  };

  const handleAIAnalyzer = useCallback(() => {
    if (!menuState.nodeId) return;
    const nodeConcept = allConcepts.find((c: EnrichedConcept) => c.id === menuState.nodeId);
    if (!nodeConcept) return;
    const priorTitles  = (nodeConcept.priorKnowledgeIds || []).map((pid: string) => allConcepts.find((c: EnrichedConcept) => c.id === pid)?.title).filter(Boolean) as string[];
    const futureTitles = allConcepts.filter((c: EnrichedConcept) => (c.priorKnowledgeIds || []).includes(nodeConcept.id)).map((c: EnrichedConcept) => c.title);
    setAiAnalysisConcept(nodeConcept);
    setAiAnalysisResult(null);
    setAiAnalysisError(null);
    setAiAnalysisLoading(true);
    setMenuState(prev => ({ ...prev, visible: false }));
    geminiService.analyzeConceptPedagogically(nodeConcept, priorTitles, futureTitles)
      .then(result => setAiAnalysisResult(result))
      .catch(() => setAiAnalysisError('Настана грешка при AI анализата. Обиди се повторно.'))
      .finally(() => setAiAnalysisLoading(false));
  }, [menuState.nodeId, allConcepts]);

  const menuStyle = useMemo(() => {
    if (!graphRef.current) return { top: menuState.y, left: menuState.x };
    const rect = graphRef.current.getBoundingClientRect();
    let left = menuState.x + 20;
    let top  = menuState.y;
    if (left + 220 > rect.width) left = menuState.x - 230;
    if (top  + 150 > rect.height) top = rect.height - 160;
    return { top, left };
  }, [menuState.x, menuState.y]);

  if (isLoading) {
    return (
      <div className="p-8 animate-fade-in">
        <header className="mb-6 animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-2/3" />
          <div className="h-6 bg-gray-200 rounded w-1/2 mt-2" />
        </header>
        <Card className="p-0">
          <div className="h-[70vh] w-full bg-gray-200 rounded flex items-center justify-center">
            <p className="text-gray-500">Го вчитувам интерактивниот граф...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 animate-fade-in h-full flex flex-col">
      <header className="mb-6 flex-shrink-0">
        <h1 className="text-4xl font-bold text-brand-primary">Интерактивен Граф на Програмата</h1>
        <p className="text-lg text-gray-600 mt-2">Визуелизирајте ги врските и вертикалната проодност.</p>
      </header>

      <GraphToolbar
        curriculum={curriculum ?? null}
        selectedGrades={selectedGrades}
        setSelectedGrades={setSelectedGrades}
        focusNodeId={focusNodeId}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        selectedStrand={selectedStrand}
        setSelectedStrand={setSelectedStrand}
        isClustered={isClustered}
        setIsClustered={setIsClustered}
        showMasteryOverlay={showMasteryOverlay}
        setShowMasteryOverlay={setShowMasteryOverlay}
        masteryLoading={masteryLoading}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        onSearchSelect={handleSearchSelect}
      />

      <div className="flex justify-between items-center mb-2 text-xs text-gray-500 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <ICONS.microphone className="w-3 h-3"/> <span>Кликни за детали / Кластер</span>
          </div>
          <div className="flex items-center gap-1">
            <ICONS.arrowPath className="w-3 h-3"/> <span>Влечи за движење</span>
          </div>
        </div>
        {focusNodeId && (
          <button type="button"
            onClick={() => { setFocusNodeId(null); setMenuState(p => ({...p, visible: false})); }}
            className="text-white font-bold bg-[#FF5722] hover:bg-[#E64A19] px-4 py-1.5 rounded-full shadow-md transition-all flex items-center gap-2 animate-fade-in"
          >
            <ICONS.close className="w-4 h-4" />
            Ресетирај Преглед (Прикажи сè)
          </button>
        )}
      </div>

      <Card className={isFullscreen ? 'fixed inset-0 z-[100] bg-white m-0 rounded-none h-screen w-screen' : 'p-0 relative border-2 border-gray-200 flex-1 min-h-[500px]'}>
        <div className="absolute top-4 right-4 z-[60] flex gap-2">
          <button type="button" onClick={handleExportImage} className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-blue-500 border border-gray-200 transition-colors" title="Зачувај како слика">
            <ICONS.download className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => setIsFullscreen(v => !v)} className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-blue-500 border border-gray-200 transition-colors" title={isFullscreen ? 'Излези од цел екран' : 'Цел екран'}>
            {isFullscreen ? <ICONS.minimize className="w-5 h-5" /> : <ICONS.maximize className="w-5 h-5" />}
          </button>
        </div>

        <div ref={graphRef} style={{ height: '100%', width: '100%', cursor: 'grab', touchAction: 'none' }} />

        <GraphLegend
          showMasteryOverlay={showMasteryOverlay}
          focusNodeId={focusNodeId}
          curriculum={curriculum ?? null}
          isClustered={isClustered}
        />

        <GraphContextMenu
          state={menuState}
          style={menuStyle}
          onClose={() => setMenuState(prev => ({ ...prev, visible: false }))}
          onViewConcept={handleViewConcept}
          onGenerateTest={handleGenerateTest}
          onGenerateIdeas={handleGenerateIdeas}
          onAIAnalyze={handleAIAnalyzer}
        />
      </Card>

      {aiAnalysisConcept && (
        <GraphAiPanel
          concept={aiAnalysisConcept}
          isLoading={aiAnalysisLoading}
          error={aiAnalysisError}
          result={aiAnalysisResult}
          onClose={() => { setAiAnalysisConcept(null); setAiAnalysisResult(null); setAiAnalysisError(null); }}
        />
      )}
    </div>
  );
};

export default CurriculumGraphView;


import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { useNavigation } from '../contexts/NavigationContext';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import type { Concept, Grade, Topic } from '../types';

declare global {
  interface Window {
    vis: any;
  }
}

interface MenuState {
  x: number;
  y: number;
  nodeId: string;
  label: string;
  visible: boolean;
  gradeLevel: number;
  topicId: string;
  isCluster: boolean;
}

type EnrichedConcept = Concept & { gradeLevel: number; topicId: string };

// П36 — XSS fix: use textContent/createElement instead of innerHTML
// innerHTML with Firestore data (title, description, items) was an XSS vector
const el = (tag: string, styles: Partial<CSSStyleDeclaration>, text?: string): HTMLElement => {
    const e = document.createElement(tag);
    Object.assign(e.style, styles);
    if (text !== undefined) e.textContent = text;
    return e;
};

const createTooltipElement = (title: string, description: string): HTMLElement => {
    const container = document.createElement('div');
    container.style.maxWidth = '300px';

    const titleDiv = el('div', { fontWeight: 'bold', marginBottom: '4px', color: '#0D47A1' }, title);
    const descDiv  = el('div', { fontSize: '0.9em', marginBottom: '8px' }, description);
    const hr = document.createElement('hr');
    hr.style.cssText = 'border-top: 1px solid #ddd; margin: 4px 0;';
    const hint = el('em', { fontSize: '0.8em', color: '#777' }, 'Кликни за да отвориш');

    container.appendChild(titleDiv);
    container.appendChild(descDiv);
    container.appendChild(hr);
    container.appendChild(hint);
    return container;
};

// П36 — XSS fix: cluster tooltip also uses DOM API, not innerHTML
const createClusterTooltip = (title: string, items: string[], total: number, color: string): HTMLElement => {
    const container = document.createElement('div');
    container.style.minWidth = '200px';
    container.style.maxWidth = '320px';

    const titleDiv = el('div', {
        fontWeight: 'bold', marginBottom: '8px', color: color,
        fontSize: '1.1em', borderBottom: `2px solid ${color}`, paddingBottom: '4px',
    }, title);

    const listDiv = el('div', { fontSize: '0.85em', color: '#333', maxHeight: '200px', overflowY: 'auto' });
    items.forEach(item => {
        listDiv.appendChild(el('div', { padding: '2px 0', borderBottom: '1px solid #f0f0f0' }, '• ' + item));
    });

    container.appendChild(titleDiv);
    container.appendChild(listDiv);

    const remaining = total - items.length;
    if (remaining > 0) {
        container.appendChild(el('div', { fontStyle: 'italic', color: '#666', fontSize: '0.8em', marginTop: '6px' }, `...и уште ${remaining} поими`));
    }
    container.appendChild(el('div', { marginTop: '8px', textAlign: 'right', fontSize: '0.75em', color: '#999' }, '(Двоен клик за отворање)'));
    return container;
};

const getRomanGrade = (level: number) => {
    switch(level) {
        case 1: return 'I';
        case 2: return 'II';
        case 3: return 'III';
        case 4: return 'IV';
        case 5: return 'V';
        case 6: return 'VI';
        case 7: return 'VII';
        case 8: return 'VIII';
        case 9: return 'IX';
        default: return level;
    }
};

const STRANDS = [
    { id: 'num', label: 'Броеви', keywords: ['броеви', 'операции', 'дропки', 'собирање', 'одземање', 'множење', 'делење', 'природни', 'цели', 'рационални'] },
    { id: 'geo', label: 'Геометрија', keywords: ['геометрија', 'форми', 'агол', 'триаголник', 'плоштина', 'волумен', 'права', 'точка', 'рамнина', 'тела'] },
    { id: 'alg', label: 'Алгебра', keywords: ['алгебра', 'функции', 'равенки', 'променлив', 'низи', 'изрази'] },
    { id: 'meas', label: 'Мерење', keywords: ['мерење', 'време', 'пари', 'должина', 'маса', 'температура', 'периметар'] },
    { id: 'data', label: 'Податоци', keywords: ['податоци', 'веројатност', 'табел', 'дијаграм', 'средна вредност', 'статистика'] },
];

const matchStrand = (concept: any, strandId: string | null): boolean => {
    if (!strandId) return true;
    const strand = STRANDS.find(s => s.id === strandId);
    if (!strand) return true;
    
    // We expect 'title' and 'description' on the concept
    const text = ((concept.title || '') + ' ' + (concept.description || '')).toLowerCase();
    
    // Check if any keyword matches
    return strand.keywords.some(k => text.includes(k));
};


export const CurriculumGraphView: React.FC = () => {
  const graphRef = useRef<HTMLDivElement>(null);
  const { navigate } = useNavigation();
  const { openGeneratorPanel } = useGeneratorPanel();
  const { allConcepts, isLoading, curriculum } = useCurriculum();
  const networkRef = useRef<any>(null);

  // Keep track of nodes in a ref to access latest state inside event listeners
  const nodesRef = useRef<any[]>([]);

  // Default to Grade 6 initially
  const [selectedGrades, setSelectedGrades] = useState<number[]>([6]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  
  // Clustering State
  const [isClustered, setIsClustered] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aiAnalysisConcept, setAiAnalysisConcept] = useState<any>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Layout Mode state
  const [layoutMode, setLayoutMode] = useState<'organic' | 'hierarchical'>('hierarchical');
  
  // Strand (Domain) Filter
  // null = All Strands
  const [selectedStrand, setSelectedStrand] = useState<string | null>(null);

  // Track the focused node to show its specific connections ignoring filters
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  
  // Context Menu State
  const [menuState, setMenuState] = useState<MenuState>({
      x: 0, y: 0, nodeId: '', label: '', visible: false, gradeLevel: 0, topicId: '', isCluster: false
  });

  // AI Analyzer: loading + result state
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    bloomLevel: string;
    bloomDetails: string;
    misconceptions: string[];
    pedagogicalBridge: string;
    diagnosticQuestion: string;
  } | null>(null);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

  const gradeColors: { [key: number]: string } = useMemo(() => ({
    1: '#F44336', // Red
    2: '#E91E63', // Pink
    3: '#9C27B0', // Purple
    4: '#673AB7', // Deep Purple
    5: '#3F51B5', // Indigo
    6: '#FFC107', // Amber
    7: '#4CAF50', // Green
    8: '#2196F3', // Blue
    9: '#009688', // Teal
  }), []);

  // Colors for Focus Mode
  const FOCUS_COLOR = '#FF5722'; // Deep Orange (Selected)
  const PRIOR_COLOR = '#1976D2'; // Blue (Prior Knowledge)
  const FUTURE_COLOR = '#388E3C'; // Green (Future Application)
  const FADED_COLOR = '#E0E0E0'; // Gray (Unrelated)

  const handleGradeToggle = (gradeLevel: number) => {
    if (focusNodeId) return; // Disable toggling while focused
    setSelectedGrades((prev: number[]) =>
      prev.includes(gradeLevel)
        ? prev.filter((g: number) => g !== gradeLevel)
        : [...prev, gradeLevel]
    );
  };
  
  const groupedTopics = useMemo(() => {
    if (!curriculum) return [];
    return curriculum.grades
      .filter((grade: Grade) => selectedGrades.includes(grade.level))
      .map((grade: Grade) => ({
        gradeLevel: grade.level,
        gradeTitle: grade.title,
        topics: grade.topics || [],
      }));
  }, [curriculum, selectedGrades]);

  useEffect(() => {
      if (!focusNodeId) {
          setSelectedTopics(groupedTopics.flatMap((group: { topics: Topic[] }) => (group.topics || []).map((t: Topic) => t.id)));
      }
  }, [groupedTopics, focusNodeId]);

  // Handle Search Input
  useEffect(() => {
      if (searchQuery.trim().length > 1 && allConcepts) {
          const results = allConcepts.filter((c: EnrichedConcept) => 
              c.title.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setSearchResults(results);
      } else {
          setSearchResults([]);
      }
  }, [searchQuery, allConcepts]);

  const handleExportImage = () => {
    if (!graphRef.current) return;
    const canvas = graphRef.current.querySelector('canvas');
    if (canvas) {
      // Create a temporary canvas to draw the current graph with white background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(canvas, 0, 0);
        const url = tempCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `curriculum-graph.png`;
        a.click();
      }
    }
  };

  const handleSearchSelect = (conceptId: string) => {
      setFocusNodeId(conceptId);
      setSearchQuery('');
      setSearchResults([]);
      setIsClustered(false); // Uncluster to show specific node
  };

  const { nodes, edges } = useMemo(() => {
    if (!allConcepts) return { nodes: [], edges: [] };

    // Sets to track classification of nodes when focused
    let activeConceptIds = new Set<string>();
    let upstreamNodes = new Set<string>(); // Parents/Ancestors
    let downstreamNodes = new Set<string>(); // Children/Descendants
    
    // 2. FOCUS LOGIC (Spotlight Mode)
    if (focusNodeId) {
        // Pre-calculate adjacency map for children (Downstream) for performance
        const childrenMap = new Map<string, string[]>();
        const parentMap = new Map<string, string[]>();

        allConcepts.forEach((c: EnrichedConcept) => {
            // Map Parents
            parentMap.set(c.id, c.priorKnowledgeIds || []);

            // Map Children
            c.priorKnowledgeIds?.forEach((pkId: string) => {
                if (!childrenMap.has(pkId)) childrenMap.set(pkId, []);
                childrenMap.get(pkId)?.push(c.id);
            });
        });

        // Trace Upstream (Recursive Parents)
        const traceUpstream = (currentId: string) => {
            const parents = parentMap.get(currentId) || [];
            parents.forEach(pid => {
                if (!upstreamNodes.has(pid) && pid !== focusNodeId) {
                    upstreamNodes.add(pid);
                    activeConceptIds.add(pid);
                    traceUpstream(pid);
                }
            });
        };

        // Trace Downstream (Recursive Children)
        const traceDownstream = (currentId: string) => {
            const children = childrenMap.get(currentId) || [];
            children.forEach(cid => {
                if (!downstreamNodes.has(cid) && cid !== focusNodeId) {
                    downstreamNodes.add(cid);
                    activeConceptIds.add(cid);
                    traceDownstream(cid);
                }
            });
        };

        // Execute Traces
        activeConceptIds.add(focusNodeId);
        traceUpstream(focusNodeId);
        traceDownstream(focusNodeId);

    } else {
        // Normal mode: Use filters
        allConcepts.forEach((concept: EnrichedConcept) => {
            const gradeMatch = selectedGrades.includes(concept.gradeLevel);
            const strandMatch = matchStrand(concept, selectedStrand);
            
            if (gradeMatch && strandMatch) {
                activeConceptIds.add(concept.id);
            }
        });
    }

    // 3. Create Node Data
    const nodesData = allConcepts
      .filter((c: EnrichedConcept) => activeConceptIds.has(c.id))
      .map((concept: EnrichedConcept) => {
            const isFocused = concept.id === focusNodeId;
            
            let nodeColor = gradeColors[concept.gradeLevel] || '#9E9E9E';
            
            if (focusNodeId) {
                if (isFocused) nodeColor = FOCUS_COLOR;
                else if (upstreamNodes.has(concept.id)) nodeColor = PRIOR_COLOR;
                else if (downstreamNodes.has(concept.id)) nodeColor = FUTURE_COLOR;
            }
            
            // Find Topic Title for Clustering
            const grade = curriculum?.grades.find((g: Grade) => g.level === concept.gradeLevel);
            const topic = grade?.topics.find((t: Topic) => t.id === concept.topicId);

            return {
                id: concept.id,
                label: concept.title.replace(/Вовед во |Операции со |Основи на /i, ''),
                title: createTooltipElement(concept.title, concept.description),
                level: concept.gradeLevel, // Use level for hierarchy
                color: nodeColor,
                font: { color: 'white', size: isFocused ? 18 : 14, face: 'Inter' },
                shape: 'box',
                borderWidth: isFocused ? 3 : 1,
                shadow: true,
                // Extra data for the menu and clustering
                _fullLabel: concept.title,
                _gradeLevel: concept.gradeLevel,
                _topicId: concept.topicId,
                _topicTitle: topic?.title || 'Општо'
            };
        });

    // 4. Create Edge Data
    const edgesData = allConcepts.flatMap((concept: EnrichedConcept) => {
      // Ensure priorKnowledgeIds exists and is an array
      const priors = Array.isArray(concept.priorKnowledgeIds) ? concept.priorKnowledgeIds : [];
      
      return priors.map((priorId: string) => {
        // Only create edge if both nodes are visible
        const isConnected = activeConceptIds.has(concept.id) && activeConceptIds.has(priorId);
        if (!isConnected) return null;

        let edgeColor = '#9E9E9E';
        let edgeWidth = 2;

        if (focusNodeId) {
            // Highlighting paths connected to focus node
            const isUpstreamPath = (upstreamNodes.has(priorId) || priorId === focusNodeId) && (upstreamNodes.has(concept.id) || concept.id === focusNodeId);
            const isDownstreamPath = (downstreamNodes.has(priorId) || priorId === focusNodeId) && (downstreamNodes.has(concept.id) || concept.id === focusNodeId);
            
            if (isUpstreamPath) {
                edgeColor = PRIOR_COLOR;
                edgeWidth = 4;
            } else if (isDownstreamPath) {
                edgeColor = FUTURE_COLOR;
                edgeWidth = 4;
            }
        }

        return {
            from: priorId,
            to: concept.id,
            arrows: 'to',
            width: edgeWidth,
            color: edgeColor,
            opacity: 1,
        };
      });
    }).filter(Boolean); // Filter out nulls

    return { nodes: nodesData, edges: edgesData };
  }, [allConcepts, selectedGrades, gradeColors, focusNodeId, curriculum, selectedStrand]);

  // Update ref whenever nodes change so click handler sees latest data
  useEffect(() => {
      nodesRef.current = nodes;
  }, [nodes]);

  // Cluster Management
  useEffect(() => {
      if (networkRef.current && nodes.length > 0) {
          const network = networkRef.current;
          
          // Reset clusters first by reloading data
          network.setData({ nodes, edges });

          if (isClustered) {
              // Get all unique topic IDs present in the current node set
              const topicsInView = new Set(nodes.map((n: any) => n._topicId));
              
              topicsInView.forEach(topicId => {
                  const topicNodes = nodes.filter((n: any) => n._topicId === topicId);
                  if (!topicNodes || topicNodes.length === 0) return;

                  const firstNode = topicNodes[0];
                  const topicTitle = firstNode._topicTitle || 'Тема';
                  const gradeLevel = firstNode._gradeLevel || 0;
                  const romanGrade = getRomanGrade(gradeLevel);
                  const color = gradeColors[gradeLevel];

                  // Create informative tooltip content for cluster (hexagon)
                  const conceptLabels = topicNodes.map((n: any) => n._fullLabel || n.label);
                  const previewCount = 10;
                  const previewItems = conceptLabels.slice(0, previewCount);
                  const titleLabel = `[${romanGrade}] ${topicTitle}`;
                  
                  const tooltipElement = createClusterTooltip(titleLabel, previewItems, conceptLabels.length, color);

                  const clusterOptions = {
                      joinCondition: (nodeOptions: any) => {
                          return nodeOptions._topicId === topicId;
                      },
                      clusterNodeProperties: {
                          id: `cluster:${topicId}`,
                          // Enhanced Label: Includes Grade Roman Numeral + Title
                          label: `[${romanGrade}] ${topicTitle}\n(${topicNodes.length} поими)`,
                          title: tooltipElement,
                          color: color,
                          shape: 'hexagon',
                          size: 40,
                          borderWidth: 2,
                          font: { size: 16, color: 'white', bold: true, multi: true },
                          allowSingleNodeCluster: true,
                          // Crucial for Hierarchical Layout to not crash
                          level: gradeLevel, 
                          _isCluster: true,
                          _topicId: topicId, 
                          _gradeLevel: gradeLevel,
                      }
                  };
                  network.cluster(clusterOptions);
              });
          }
      }
  }, [isClustered, nodes, edges, gradeColors, layoutMode]);

  // Effect to apply Layout Mode changes
  useEffect(() => {
    if (networkRef.current) {
        const options = {
            layout: {
                hierarchical: layoutMode === 'hierarchical' ? {
                    enabled: true,
                    direction: 'LR',
                    sortMethod: 'directed',
                    levelSeparation: 250,
                    nodeSpacing: 100,
                    treeSpacing: 200,
                    blockShifting: true,
                    edgeMinimization: true,
                    parentCentralization: true, 
                } : {
                    enabled: false
                }
            },
            physics: layoutMode === 'hierarchical' ? {
                enabled: false  // Disable physics in hierarchy for stability
            } : {
                // Organic settings
                barnesHut: {
                    gravitationalConstant: -20000,
                    centralGravity: 0.3,
                    springLength: 150,
                    springConstant: 0.05,
                    damping: 0.09,
                    avoidOverlap: 0.5
                },
                minVelocity: 0.75,
                stabilization: {
                    enabled: true,
                    iterations: 1000
                }
            }
        };
        networkRef.current.setOptions(options);

        // Re-fit view slightly after layout change
        setTimeout(() => networkRef.current.fit({ animation: true }), 500);
    }
  }, [layoutMode]);


  useEffect(() => {
    if (graphRef.current && window.vis && !isLoading) {
      // Initial Setup is done only once
      if (networkRef.current) return;
      
      const data = { nodes, edges };
      const options = {
        nodes: {
          shape: 'box',
          margin: 12,
          widthConstraint: { maximum: 220 },
        },
        edges: {
          color: '#BDBDBD',
          smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.4 }
        },
        layout: {
          hierarchical: {
            enabled: true,
            direction: 'LR', // Left-Right for horizontal progression
            sortMethod: 'directed',
            levelSeparation: 250,
            nodeSpacing: 200,
            treeSpacing: 250,       
            blockShifting: true,   
            edgeMinimization: true, 
            parentCentralization: true,
            shakeTowards: 'leaves', 
          }
        },
        physics: {
          enabled: false, 
          hierarchicalRepulsion: {
            centralGravity: 0.0,
            springLength: 100,
            springConstant: 0.01,
            nodeDistance: 120,
            damping: 0.09
          },
        },
        interaction: {
          dragNodes: true,
          dragView: true,
          zoomView: true,
          navigationButtons: true,
          keyboard: true,
          tooltipDelay: 200,
          hover: true,
          selectable: true,
        },
      };

      const network = new window.vis.Network(graphRef.current, data, options);
      networkRef.current = network;

      // Click handler for menu and focus
      network.on('click', (params: any) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          
          // Check if it's a cluster
          if (network.isCluster(nodeId)) {
              network.openCluster(nodeId);
              return;
          }

          // Toggle focus
          setFocusNodeId(nodeId);
            setIsClustered(false);
          
          // Find node data using REF to avoid stale closure
          const nodeData = nodesRef.current.find((n: any) => n.id === nodeId);
          
          if (nodeData) {
              // Calculate center of the graph container for fallback
              const x = params.pointer.DOM.x;
              const y = params.pointer.DOM.y;

              setMenuState({
                  x: x,
                  y: y,
                  nodeId: nodeId,
                  label: nodeData._fullLabel || nodeData.label,
                  gradeLevel: nodeData._gradeLevel,
                  topicId: nodeData._topicId,
                  visible: true,
                  isCluster: false
              });
          }
        } else {
          setMenuState((prev: MenuState) => ({ ...prev, visible: false }));
        }
      });
      
      network.on('dragStart', () => setMenuState((prev: MenuState) => ({ ...prev, visible: false })));

      network.on("hoverNode", function () {
        if(graphRef.current) graphRef.current.style.cursor = "pointer";
      });
      network.on("blurNode", function () {
        if(graphRef.current) graphRef.current.style.cursor = "default";
      });

      network.on('doubleClick', (params: any) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          if (network.isCluster(nodeId)) {
              network.openCluster(nodeId);
          } else if (String(nodeId).startsWith('g')) { 
            navigate(`/concept/${nodeId}`);
          }
        }
      });
    }
  }, [isLoading, navigate]); 

  useEffect(() => {
    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, []);

  // Action Handlers
  const handleViewConcept = () => {
      if(menuState.nodeId) navigate(`/concept/${menuState.nodeId}`);
  };

  const handleGenerateTest = () => {
      if(menuState.nodeId) {
          const gradeId = `grade-${menuState.gradeLevel}`;
          openGeneratorPanel({
              selectedGrade: gradeId,
              selectedTopic: menuState.topicId,
              selectedConcepts: [menuState.nodeId],
              contextType: 'CONCEPT',
              materialType: 'ASSESSMENT'
          });
          setMenuState((prev: MenuState) => ({ ...prev, visible: false }));
      }
  };

  const handleAIAnalyzer = useCallback(() => {
      if (!menuState.nodeId) return;
      const nodeConcept = allConcepts.find((c: EnrichedConcept) => c.id === menuState.nodeId);
      if (!nodeConcept) return;

      // Resolve prior + future concept titles for richer AI context
      const priorTitles = (nodeConcept.priorKnowledgeIds || [])
          .map((pid: string) => allConcepts.find((c: EnrichedConcept) => c.id === pid)?.title)
          .filter(Boolean) as string[];
      const futureTitles = allConcepts
          .filter((c: EnrichedConcept) => (c.priorKnowledgeIds || []).includes(nodeConcept.id))
          .map((c: EnrichedConcept) => c.title);

      setAiAnalysisConcept(nodeConcept);
      setAiAnalysisResult(null);
      setAiAnalysisError(null);
      setAiAnalysisLoading(true);
      setMenuState((prev: MenuState) => ({ ...prev, visible: false }));

      geminiService.analyzeConceptPedagogically(nodeConcept, priorTitles, futureTitles)
          .then(result => { setAiAnalysisResult(result); })
          .catch(() => { setAiAnalysisError('Настана грешка при AI анализата. Обиди се повторно.'); })
          .finally(() => setAiAnalysisLoading(false));
  }, [menuState.nodeId, allConcepts]);

  const handleGenerateIdeas = () => {
      if(menuState.nodeId) {
          const gradeId = `grade-${menuState.gradeLevel}`;
          openGeneratorPanel({
              selectedGrade: gradeId,
              selectedTopic: menuState.topicId,
              selectedConcepts: [menuState.nodeId],
              contextType: 'CONCEPT',
              materialType: 'SCENARIO'
          });
          setMenuState((prev: MenuState) => ({ ...prev, visible: false }));
      }
  };

  // Improved positioning logic
  const menuStyle = useMemo(() => {
      if (!graphRef.current) return { top: menuState.y, left: menuState.x };
      const rect = graphRef.current.getBoundingClientRect();
      
      let left = menuState.x + 20;
      let top = menuState.y;
      
      if (left + 220 > rect.width) left = menuState.x - 230;
      if (top + 150 > rect.height) top = rect.height - 160;

      return { top, left };
  }, [menuState.x, menuState.y]);


  if (isLoading) {
      return (
        <div className="p-8 animate-fade-in">
             <header className="mb-6 animate-pulse">
                <div className="h-10 bg-gray-200 rounded w-2/3"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2 mt-2"></div>
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
        
      <Card className="mb-4 flex-shrink-0 overflow-visible z-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className={`flex flex-wrap items-center gap-4 ${focusNodeId ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Select All / Deselect All shortcut */}
                    <button
                        onClick={() => {
                            if (!curriculum || focusNodeId) return;
                            const allLevels = curriculum.grades.map((g: Grade) => g.level);
                            setSelectedGrades(
                                selectedGrades.length === allLevels.length ? [6] : allLevels
                            );
                        }}
                        type="button"
                        disabled={!!focusNodeId}
                        className={`px-3 py-1 text-xs font-bold rounded-full border-2 transition-all duration-200 ${
                            curriculum && selectedGrades.length === curriculum.grades.length
                                ? 'bg-slate-700 text-white border-slate-700'
                                : 'bg-white text-slate-500 border-slate-300 hover:border-slate-500'
                        }`}
                        title="Избери / одбери ги сите одделенија"
                    >
                        {curriculum && selectedGrades.length === curriculum.grades.length ? '✕ Сите' : '✓ Сите'}
                    </button>
                    <div className="w-px h-5 bg-gray-300" />
                    {curriculum?.grades.map((grade: Grade) => (
                        <button
                            key={grade.level}
                            onClick={() => handleGradeToggle(grade.level)}
                            disabled={!!focusNodeId}
                            className={`px-3 py-1 text-sm font-semibold rounded-full transition-all duration-200 border-2 ${
                                selectedGrades.includes(grade.level)
                                    ? `text-white border-transparent shadow-md`
                                    : 'text-gray-700 bg-gray-100 border-gray-100 hover:border-gray-300'
                            }`}
                            style={{
                            backgroundColor: selectedGrades.includes(grade.level) ? gradeColors[grade.level] : undefined
                            }}
                        >
                            {grade.level}. одд.
                        </button>
                    ))}
                </div>
                
                {/* Clustering Toggle */}
                <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>
                
                {/* Layout Mode Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                    <button
                        onClick={() => setLayoutMode('organic')}
                        className={`flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            layoutMode === 'organic'
                            ? 'bg-white text-brand-primary shadow-sm border border-gray-200' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <ICONS.share className="w-3 h-3" /> Органски
                    </button>
                    <button
                        onClick={() => setLayoutMode('hierarchical')}
                        className={`flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            layoutMode === 'hierarchical'
                            ? 'bg-white text-brand-primary shadow-sm border border-gray-200' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <ICONS.gitBranch className="w-3 h-3 rotate-90" /> Прогресија
                    </button>
                </div>

                <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>
                
                {/* Strand Filter */}
                <div className="flex items-center">
                    <select
                        value={selectedStrand || ''}
                        onChange={(e) => setSelectedStrand(e.target.value || null)}
                        disabled={!!focusNodeId}
                        className={`bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-brand-primary focus:border-brand-primary block w-32 md:w-40 p-1.5 ${focusNodeId ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <option value="">Сите Подрачја</option>
                        {STRANDS.map(strand => (
                            <option key={strand.id} value={strand.id}>{strand.label}</option>
                        ))}
                    </select>
                </div>

                <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>

                <button
                    onClick={() => setIsClustered(!isClustered)}
                    className={`flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 border ${
                        isClustered 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    <ICONS.menu className="w-4 h-4" />
                    {isClustered ? 'Групирано по Теми' : 'Детален приказ (Поими)'}
                </button>
            </div>

            {/* Search in Graph */}
            <div className="relative w-full md:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ICONS.search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
                    placeholder="Пронајди поим во графот..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
                {searchResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                        {searchResults.map((result: EnrichedConcept) => (
                            <li
                                key={result.id}
                                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50 text-gray-900"
                                onClick={() => handleSearchSelect(result.id)}
                            >
                                <span className="block truncate font-medium">{result.title}</span>
                                <span className="block truncate text-xs text-gray-500">{result.gradeLevel}. одд</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
      </Card>

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
                <button 
                    onClick={() => { setFocusNodeId(null); setMenuState((p: MenuState) => ({...p, visible: false})); }}
                    className="text-white font-bold bg-[#FF5722] hover:bg-[#E64A19] px-4 py-1.5 rounded-full shadow-md transition-all flex items-center gap-2 animate-fade-in"
                >
                    <ICONS.close className="w-4 h-4" />
                    Ресетирај Преглед (Прикажи сè)
                </button>
            )}
      </div>
      
      <Card className={isFullscreen ? 'fixed inset-0 z-[100] bg-white m-0 rounded-none h-screen w-screen' : 'p-0 relative border-2 border-gray-200 flex-1 min-h-[500px]'}>
        <div className="absolute top-4 right-4 z-[60] flex gap-2">
            <button onClick={handleExportImage} className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-blue-500 border border-gray-200 transaction-colors" title="Зачувај како слика">
                <ICONS.download className="w-5 h-5" />
            </button>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-blue-500 border border-gray-200 transaction-colors" title={isFullscreen ? "Излези од цел екран" : "Цел екран"}>
                {isFullscreen ? <ICONS.minimize className="w-5 h-5" /> : <ICONS.maximize className="w-5 h-5" />}
            </button>
        </div>
         <div ref={graphRef} style={{ height: '100%', width: '100%', cursor: 'grab', touchAction: 'none' }} />
         
         {/* Enhanced Legend */}
         <div className="absolute bottom-12 right-4 bg-white/95 p-4 rounded-lg shadow-xl border border-gray-200 text-xs max-w-xs backdrop-blur-sm z-10">
             <div className="font-bold mb-2 text-gray-800 text-sm border-b pb-1 flex justify-between items-center">
                 <span>Легенда</span>
             </div>
             <div className="space-y-3">
                 {!focusNodeId ? (
                     <div className="grid grid-cols-2 gap-y-2 gap-x-4 animate-fade-in">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm shadow-sm border border-gray-300" style={{backgroundColor: gradeColors[6]}}></div> 6. Одд. (VI)</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm shadow-sm border border-gray-300" style={{backgroundColor: gradeColors[7]}}></div> 7. Одд. (VII)</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm shadow-sm border border-gray-300" style={{backgroundColor: gradeColors[8]}}></div> 8. Одд. (VIII)</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm shadow-sm border border-gray-300" style={{backgroundColor: gradeColors[9]}}></div> 9. Одд. (IX)</div>
                        {isClustered && <div className="col-span-2 flex items-start gap-2 mt-2 border-t pt-2 text-gray-600"><div className="mt-0.5" style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '10px solid gray' }}></div> <span>Тематски кластер (содржи ознака за одделение [VI-IX])</span></div>}
                     </div>
                 ) : (
                     <div className="space-y-2 animate-fade-in">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm border-2 border-white shadow-sm" style={{backgroundColor: PRIOR_COLOR}}></div> 
                            <span className="font-medium text-gray-700">Предзнаење (Основа)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm border-2 border-white shadow-sm" style={{backgroundColor: FOCUS_COLOR}}></div> 
                            <span className="font-bold text-gray-900">Активен Фокус</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm border-2 border-white shadow-sm" style={{backgroundColor: FUTURE_COLOR}}></div> 
                            <span className="font-medium text-gray-700">Идни Знаења (Примена)</span>
                        </div>
                     </div>
                 )}
                 
                 {focusNodeId && (
                    <div className="border-t pt-2 bg-orange-50 -mx-4 px-4 pb-2 -mb-4 rounded-b-lg text-[10px] text-gray-600 leading-tight mt-2">
                        <strong>Режим на Фокус:</strong> Прикажани се само поврзаните поими за да се олесни следењето на вертикалната прогресија.
                    </div>
                 )}
             </div>
         </div>

         {/* Pop-up Menu */}
         {menuState.visible && (
             <div 
                className="absolute z-20 bg-white rounded-lg shadow-2xl border border-gray-100 p-2 animate-fade-in-up flex flex-col gap-1 min-w-[240px]"
                style={{ 
                    top: menuStyle.top,
                    left: menuStyle.left
                }}
             >
                 <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-start bg-gray-50 rounded-t-lg -mx-2 -mt-2 mb-1">
                     <div>
                        <p className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">Опции за поим</p>
                        <p className="text-sm font-bold text-gray-800 line-clamp-2 leading-tight">{menuState.label}</p>
                     </div>
                     <button onClick={() => setMenuState((prev: MenuState) => ({...prev, visible: false}))} className="text-gray-400 hover:text-red-500 transition-colors">
                        <ICONS.close className="w-4 h-4" />
                     </button>
                 </div>
                 <button onClick={handleViewConcept} className="flex items-center text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-brand-secondary p-2 rounded transition-colors font-medium">
                     <ICONS.bookOpen className="w-4 h-4 mr-3 text-blue-500"/> Види детали за поимот
                 </button>
                 <button onClick={handleGenerateTest} className="flex items-center text-left text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 p-2 rounded transition-colors font-medium">
                     <ICONS.generator className="w-4 h-4 mr-3 text-purple-500"/> Генерирај Тест/Квиз
                 </button>
                 <button onClick={handleGenerateIdeas} className="flex items-center text-left text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 p-2 rounded transition-colors font-medium">
                     <ICONS.lightbulb className="w-4 h-4 mr-3 text-yellow-500"/> Генерирај Идеи за час
                 </button>
                   <button onClick={handleAIAnalyzer} className="flex items-center text-left text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 p-2 rounded transition-colors font-medium border-t border-gray-100 mt-1 pt-3">
                       <ICONS.zap className="w-4 h-4 mr-3 text-green-500"/> AI Педагошки Анализатор
                   </button>
               </div>
           )}
        </Card>

      {aiAnalysisConcept && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex justify-center items-start pt-[8vh] sm:pt-[10vh] pb-8 p-4 overflow-y-auto w-full h-[100dvh]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col mb-auto animate-fade-in-up relative z-[1001]">
                <div className="bg-gradient-to-r from-green-500 to-teal-600 p-4 text-white flex justify-between items-center shrink-0 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-full"><ICONS.zap className="w-6 h-6 text-white" /></div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">AI Педагошки Анализатор</h3>
                            <p className="text-green-100 text-xs opacity-90">{aiAnalysisConcept.title}</p>
                        </div>
                    </div>
                    <button onClick={() => { setAiAnalysisConcept(null); setAiAnalysisResult(null); setAiAnalysisError(null); }} className="text-white hover:text-green-200 transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-full">
                        <ICONS.close className="w-5 h-5"/>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col gap-4 text-left">
                    {aiAnalysisLoading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-gray-500 font-medium">AI анализира когнитивни нивоа и мисконцепции за<br/><strong className="text-gray-700">{aiAnalysisConcept.title}</strong>...</p>
                        </div>
                    )}

                    {aiAnalysisError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                            <ICONS.alertTriangle className="w-4 h-4 inline mr-2" />{aiAnalysisError}
                        </div>
                    )}

                    {aiAnalysisResult && !aiAnalysisLoading && (<>
                        <div className="bg-white p-4 rounded-xl border-l-4 border-blue-500 shadow-sm">
                            <h4 className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                               <ICONS.activity className="w-4 h-4 text-blue-500"/> 🎯 Блумова таксономија — <span className="text-blue-600">{aiAnalysisResult.bloomLevel}</span>
                            </h4>
                            <p className="text-gray-700 text-sm pl-6 border-l-2 border-blue-100">{aiAnalysisResult.bloomDetails}</p>
                        </div>

                        <div className="bg-white p-4 rounded-xl border-l-4 border-red-500 shadow-sm">
                            <h4 className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                               <ICONS.alertTriangle className="w-4 h-4 text-red-500"/> 🚧 Чести мисконцепции
                            </h4>
                            <ul className="space-y-1.5 pl-6 border-l-2 border-red-100">
                                {aiAnalysisResult.misconceptions.map((m, i) => (
                                    <li key={i} className="text-gray-700 text-sm flex gap-2"><span className="text-red-400 font-bold flex-shrink-0">•</span>{m}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-white p-4 rounded-xl border-l-4 border-purple-500 shadow-sm">
                            <h4 className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                               <ICONS.gitBranch className="w-4 h-4 text-purple-500 rotate-90"/> 🌉 Педагошки Мост
                            </h4>
                            <p className="text-gray-700 text-sm pl-6 border-l-2 border-purple-100">{aiAnalysisResult.pedagogicalBridge}</p>
                        </div>

                        <div className="bg-white p-4 rounded-xl border-l-4 border-orange-500 shadow-sm">
                            <h4 className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                               <ICONS.zap className="w-4 h-4 text-orange-500"/> ⏱️ Блиц Дијагностика
                            </h4>
                            <p className="text-gray-700 font-medium text-sm pl-4 border-l-2 border-orange-200 italic bg-orange-50 py-3 pr-3 rounded-r-lg">
                                {aiAnalysisResult.diagnosticQuestion}
                            </p>
                        </div>
                    </>)}
                </div>
                
                <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
                    <button onClick={() => { setAiAnalysisConcept(null); setAiAnalysisResult(null); setAiAnalysisError(null); }} className="px-5 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition-colors">
                        Затвори
                    </button>
                </div>
            </div>
        </div>
      )}

      </div>
    );
  };

export default CurriculumGraphView;

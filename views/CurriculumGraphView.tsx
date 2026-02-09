
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { useNavigation } from '../contexts/NavigationContext';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { ICONS } from '../constants';

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

const createTooltipElement = (title: string, description: string): HTMLElement => {
    const container = document.createElement('div');
    container.style.maxWidth = '300px'; // To match CSS
    container.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px; color: #0D47A1;">${title}</div>
      <div style="font-size: 0.9em; margin-bottom: 8px;">${description}</div>
      <hr style="border-top: 1px solid #ddd; margin: 4px 0;" />
      <em style="font-size: 0.8em; color: #777;">Кликни за да отвориш</em>
    `;
    return container;
};

// New helper for cluster tooltips (list based)
const createClusterTooltip = (title: string, items: string[], total: number, color: string): HTMLElement => {
    const container = document.createElement('div');
    container.style.minWidth = '200px';
    container.style.maxWidth = '320px';
    
    const listHtml = items.map(item => 
        `<div style="padding: 2px 0; border-bottom: 1px solid #f0f0f0;">• ${item}</div>`
    ).join('');
    
    const remaining = total - items.length;
    
    container.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: ${color}; font-size: 1.1em; border-bottom: 2px solid ${color}; padding-bottom: 4px;">
        ${title}
      </div>
      <div style="font-size: 0.85em; color: #333; max-height: 200px; overflow-y: auto;">
        ${listHtml}
      </div>
      ${remaining > 0 ? `<div style="font-style: italic; color: #666; font-size: 0.8em; margin-top: 6px;">...и уште ${remaining} поими</div>` : ''}
      <div style="margin-top: 8px; text-align: right; font-size: 0.75em; color: #999;">
        (Двоен клик за отворање)
      </div>
    `;
    return container;
};

const getRomanGrade = (level: number) => {
    switch(level) {
        case 6: return 'VI';
        case 7: return 'VII';
        case 8: return 'VIII';
        case 9: return 'IX';
        default: return level;
    }
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
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Track the focused node to show its specific connections ignoring filters
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  
  // Context Menu State
  const [menuState, setMenuState] = useState<MenuState>({ 
      x: 0, y: 0, nodeId: '', label: '', visible: false, gradeLevel: 0, topicId: '', isCluster: false
  });

  const gradeColors: { [key: number]: string } = useMemo(() => ({
    6: '#FFC107', // Amber
    7: '#4CAF50', // Green
    8: '#2196F3', // Blue
    9: '#9C27B0', // Purple
  }), []);

  // Colors for Focus Mode
  const FOCUS_COLOR = '#FF5722'; // Deep Orange (Selected)
  const PRIOR_COLOR = '#1976D2'; // Blue (Prior Knowledge)
  const FUTURE_COLOR = '#388E3C'; // Green (Future Application)
  const FADED_COLOR = '#E0E0E0'; // Gray (Unrelated)

  const handleGradeToggle = (gradeLevel: number) => {
    if (focusNodeId) return; // Disable toggling while focused
    setSelectedGrades(prev =>
      prev.includes(gradeLevel)
        ? prev.filter(g => g !== gradeLevel)
        : [...prev, gradeLevel]
    );
  };
  
  const groupedTopics = useMemo(() => {
    if (!curriculum) return [];
    return curriculum.grades
      .filter(grade => selectedGrades.includes(grade.level))
      .map(grade => ({
        gradeLevel: grade.level,
        gradeTitle: grade.title,
        topics: grade.topics,
      }));
  }, [curriculum, selectedGrades]);

  useEffect(() => {
      if (!focusNodeId) {
          setSelectedTopics(groupedTopics.flatMap(group => group.topics.map(t => t.id)));
      }
  }, [groupedTopics, focusNodeId]);

  // Handle Search Input
  useEffect(() => {
      if (searchQuery.trim().length > 1 && allConcepts) {
          const results = allConcepts.filter(c => 
              c.title.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setSearchResults(results);
      } else {
          setSearchResults([]);
      }
  }, [searchQuery, allConcepts]);

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

        allConcepts.forEach(c => {
            // Map Parents
            parentMap.set(c.id, c.priorKnowledgeIds);

            // Map Children
            c.priorKnowledgeIds.forEach(pkId => {
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
        allConcepts.forEach(concept => {
            if (selectedGrades.includes(concept.gradeLevel)) {
                activeConceptIds.add(concept.id);
            }
        });
    }

    // 3. Create Node Data
    const nodesData = allConcepts
        .filter(c => activeConceptIds.has(c.id))
        .map(concept => {
            const isFocused = concept.id === focusNodeId;
            
            let nodeColor = gradeColors[concept.gradeLevel] || '#9E9E9E';
            
            if (focusNodeId) {
                if (isFocused) nodeColor = FOCUS_COLOR;
                else if (upstreamNodes.has(concept.id)) nodeColor = PRIOR_COLOR;
                else if (downstreamNodes.has(concept.id)) nodeColor = FUTURE_COLOR;
            }
            
            // Find Topic Title for Clustering
            const grade = curriculum?.grades.find(g => g.level === concept.gradeLevel);
            const topic = grade?.topics.find(t => t.id === concept.topicId);

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
    const edgesData = allConcepts.flatMap(concept =>
      concept.priorKnowledgeIds.map(priorId => {
        // Only create edge if both nodes are visible
        const isConnected = activeConceptIds.has(concept.id) && activeConceptIds.has(priorId);
        if (!isConnected) return null;

        let edgeColor = '#B0BEC5';
        let edgeWidth = 1;

        if (focusNodeId) {
            // Highlighting paths connected to focus node
            const isUpstreamPath = (upstreamNodes.has(priorId) || priorId === focusNodeId) && (upstreamNodes.has(concept.id) || concept.id === focusNodeId);
            const isDownstreamPath = (downstreamNodes.has(priorId) || priorId === focusNodeId) && (downstreamNodes.has(concept.id) || concept.id === focusNodeId);
            
            if (isUpstreamPath) {
                edgeColor = PRIOR_COLOR;
                edgeWidth = 2;
            } else if (isDownstreamPath) {
                edgeColor = FUTURE_COLOR;
                edgeWidth = 2;
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
      })
    ).filter(Boolean);

    return { nodes: nodesData, edges: edgesData };
  }, [allConcepts, selectedGrades, gradeColors, focusNodeId, curriculum]);

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
              const topicsInView = new Set(nodes.map(n => n._topicId));
              
              topicsInView.forEach(topicId => {
                  const topicNodes = nodes.filter(n => n._topicId === topicId);
                  if (!topicNodes || topicNodes.length === 0) return;

                  const firstNode = topicNodes[0];
                  const topicTitle = firstNode._topicTitle || 'Тема';
                  const gradeLevel = firstNode._gradeLevel || 0;
                  const romanGrade = getRomanGrade(gradeLevel);
                  const color = gradeColors[gradeLevel];

                  // Create informative tooltip content for cluster (hexagon)
                  const conceptLabels = topicNodes.map(n => n._fullLabel || n.label);
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
  }, [isClustered, nodes, edges, gradeColors]);


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
          smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.4 }
        },
        layout: {
          hierarchical: {
            enabled: true,
            direction: 'UD', // Up-Down for vertical progression
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
          
          // Find node data using REF to avoid stale closure
          const nodeData = nodesRef.current.find(n => n.id === nodeId);
          
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
          setMenuState(prev => ({ ...prev, visible: false }));
        }
      });
      
      network.on('dragStart', () => setMenuState(prev => ({ ...prev, visible: false })));

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
          openGeneratorPanel({
              grade: String(menuState.gradeLevel),
              topicId: menuState.topicId,
              conceptId: menuState.nodeId,
              contextType: 'CONCEPT',
              materialType: 'ASSESSMENT'
          });
          setMenuState(prev => ({ ...prev, visible: false }));
      }
  };

  const handleGenerateIdeas = () => {
      if(menuState.nodeId) {
          openGeneratorPanel({
              grade: String(menuState.gradeLevel),
              topicId: menuState.topicId,
              conceptId: menuState.nodeId,
              contextType: 'CONCEPT',
              materialType: 'SCENARIO'
          });
          setMenuState(prev => ({ ...prev, visible: false }));
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
                <div className="flex items-center gap-2">
                    {curriculum?.grades.map(grade => (
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                        {searchResults.map((result) => (
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
                    onClick={() => { setFocusNodeId(null); setMenuState(p => ({...p, visible: false})); }}
                    className="text-white font-bold bg-[#FF5722] hover:bg-[#E64A19] px-4 py-1.5 rounded-full shadow-md transition-all flex items-center gap-2 animate-fade-in"
                >
                    <ICONS.close className="w-4 h-4" />
                    Ресетирај Преглед (Прикажи сè)
                </button>
            )}
      </div>
      
      <Card className="p-0 relative border-2 border-gray-200 flex-1 min-h-[500px]">
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
                     <button onClick={() => setMenuState(prev => ({...prev, visible: false}))} className="text-gray-400 hover:text-red-500 transition-colors">
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
             </div>
         )}
      </Card>
    </div>
  );
};

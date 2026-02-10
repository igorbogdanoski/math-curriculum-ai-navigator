import React, { useMemo, memo, useState, useRef, useEffect, useCallback } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import type { Concept, NationalStandard, Topic } from '../types';
import { MathRenderer } from '../components/common/MathRenderer';
import { useNavigation } from '../contexts/NavigationContext';
import { useModal } from '../contexts/ModalContext';
import { useNotification } from '../contexts/NotificationContext';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';

interface TopicViewProps {
  id: string;
}

const groupStandards = (standards: string[]): Record<string, {text: string, originalIndex: number}[]> => {
  const groups: Record<string, {text: string, originalIndex: number}[]> = {
    'Основни Поими и Дефиниции': [],
    'Пресметки и Решавање Проблеми': [],
    'Конструкции и Визуелизација': [],
    'Останати': [],
  };

  const keywords = {
    'Основни Поими и Дефиниции': ['објаснува', 'дефинира', 'препознава', 'разликува', 'именува', 'опишува', 'споредува', 'чита', 'искажува', 'наведува', 'запишува', 'воочува'],
    'Пресметки и Решавање Проблеми': ['пресметува', 'одредува', 'решава', 'применува', 'користи', 'проценува', 'проверува', 'оправдува', 'изразува', 'собира', 'множи', 'дели', 'заокружува', 'наоѓа'],
    'Конструкции и Визуелизација': ['црта', 'конструира', 'скицира', 'претставува', 'означува', 'класифицира'],
  };

  standards.forEach((standard, index) => {
    const lowerStandard = standard.toLowerCase();
    let assigned = false;
    for (const [group, KWs] of Object.entries(keywords)) {
      if (KWs.some(kw => lowerStandard.trim().startsWith(kw))) {
        groups[group].push({ text: standard, originalIndex: index });
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      groups['Останати'].push({ text: standard, originalIndex: index });
    }
  });

  const filteredGroups: Record<string, {text: string, originalIndex: number}[]> = {};
  for (const [key, value] of Object.entries(groups)) {
    if (value.length > 0) {
      filteredGroups[key] = value;
    }
  }
  return filteredGroups;
};

const StandardGroup: React.FC<{
  title: string;
  standards: {text: string, originalIndex: number}[];
  icon: React.ComponentType<{ className?: string }>;
  isEditing: boolean;
  onStandardChange: (originalIndex: number, newText: string) => void;
}> = ({ title, standards, icon: Icon, isEditing, onStandardChange }) => {
  return (
    <div className="border-t border-gray-100 first:border-t-0 pt-3 mt-3 first:mt-0">
        <div className="flex items-center">
          <Icon className="w-5 h-5 mr-3 text-brand-secondary" />
          <h5 className="font-semibold text-gray-800">{title} ({standards.length})</h5>
        </div>
        <ul className="space-y-3 py-2 pl-4">
          {standards.map((standardItem: {text: string, originalIndex: number}) => (
            <li key={standardItem.originalIndex} className="flex items-start">
               <ICONS.check className="w-4 h-4 mr-2 mt-1 flex-shrink-0 text-green-500" />
               <div className="flex-1 text-gray-700 text-sm">
                 {isEditing ? (
                    <textarea
                      value={standardItem.text}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onStandardChange(standardItem.originalIndex, e.target.value)}
                      className={`w-full p-1 border rounded-md shadow-sm text-sm ${isEditing ? 'animate-pulse-bg-blue' : ''}`}
                      rows={2}
                    />
                  ) : (
                    <MathRenderer text={standardItem.text} />
                  )}
               </div>
            </li>
          ))}
        </ul>
    </div>
  );
};


const ConceptCard: React.FC<{
  concept: Concept;
  allConceptsInTopic: Concept[];
  gradeLevel: number;
  topicId: string;
  isExpanded: boolean;
  onToggle: (conceptId: string) => void;
  navigate: (path: string) => void;
  isEditing: boolean;
  onAssessmentStandardChange: (conceptId: string, index: number, newText: string) => void;
  onActivitiesChange: (conceptId: string, newActivities: string[]) => void;
}> = memo(({ concept, allConceptsInTopic, gradeLevel, topicId, isExpanded, onToggle, navigate, isEditing, onAssessmentStandardChange, onActivitiesChange }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const { openGeneratorPanel } = useGeneratorPanel();

  const arrayToString = (arr: string[] = []) => arr.join('\n');
  const stringToArray = (str: string = '') => str.split('\n').filter(line => line.trim() !== '');

  const groupedStandards = useMemo(() => groupStandards(concept.assessmentStandards), [concept.assessmentStandards]);
  const groupIcons = useMemo(() => ({
      'Основни Поими и Дефиниции': ICONS.lightbulb,
      'Пресметки и Решавање Проблеми': ICONS.sparkles,
      'Конструкции и Визуелизација': ICONS.edit,
      'Останати': ICONS.menu,
  }), []);

  const handleGenerateMaterials = () => {
    openGeneratorPanel({
        grade: String(gradeLevel),
        topicId: topicId,
        conceptId: concept.id,
        contextType: 'CONCEPT'
    });
  };

  const conceptIndex = useMemo(() => allConceptsInTopic.findIndex((c: Concept) => c.id === concept.id), [allConceptsInTopic, concept.id]);
  const hasPrev = conceptIndex > 0;
  const hasNext = conceptIndex < allConceptsInTopic.length - 1;

  const handlePrev = () => {
      if (hasPrev) {
          onToggle(allConceptsInTopic[conceptIndex - 1].id);
      }
  };

  const handleNext = () => {
      if (hasNext) {
          onToggle(allConceptsInTopic[conceptIndex + 1].id);
      }
  };


  return (
    <div className="border border-gray-200 rounded-lg mb-3 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
      <button
        onClick={() => onToggle(concept.id)}
        className="w-full flex justify-between items-center p-4 text-left"
        aria-expanded={isExpanded}
        aria-controls={`concept-content-${concept.id}`}
      >
        <h3 className="text-lg font-semibold text-brand-primary"><MathRenderer text={concept.title} /></h3>
        <ICONS.chevronDown className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
      <div
        ref={contentRef}
        id={`concept-content-${concept.id}`}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isExpanded ? `${contentRef.current?.scrollHeight}px` : '0px' }}
      >
        <div className="p-4 border-t space-y-4">
          <p className="text-gray-600"><MathRenderer text={concept.description} /></p>
          
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Стандарди за оценување:</h4>
            <div className="pl-2 border-l-2 border-gray-100">
                {Object.keys(groupedStandards).length > 0 ? (
                    Object.entries(groupedStandards).map(([groupName, standardsInGroup]) => (
                        <StandardGroup
                            key={groupName}
                            title={groupName}
                            standards={standardsInGroup}
                            icon={groupIcons[groupName as keyof typeof groupIcons] || ICONS.menu}
                            isEditing={isEditing}
                            onStandardChange={(originalIndex: number, newText: string) => onAssessmentStandardChange(concept.id, originalIndex, newText)}
                        />
                    ))
                ) : (
                    <p className="text-sm text-gray-500 italic py-2">Нема дефинирани стандарди за оценување за овој поим.</p>
                )}
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Предлог активности:</h4>
            {isEditing ? (
                <textarea
                  value={arrayToString(concept.activities)}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onActivitiesChange(concept.id, stringToArray(e.target.value))}
                  className={`w-full p-2 border rounded-md shadow-sm text-sm ${isEditing ? 'animate-pulse-bg-blue' : ''}`}
                  rows={5}
                  placeholder="Внесете секоја активност во нов ред..."
                />
            ) : (
                concept.activities && concept.activities.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
                    {concept.activities.map((activity: string, i: number) => <li key={i}><MathRenderer text={activity} /></li>)}
                  </ul>
                ) : (
                   <p className="text-sm text-gray-500 italic">Нема дефинирани предлог активности.</p>
                )
            )}
          </div>

          <div className="mt-4 flex flex-wrap justify-between items-center gap-2 pt-4 border-t">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate(`/concept/${concept.id}`)} className="flex items-center bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                <ICONS.bookOpen className="w-5 h-5 mr-2" />
                Види детали за поимот
              </button>
              <button onClick={handleGenerateMaterials} className="flex items-center bg-brand-secondary text-white px-3 py-2 rounded-lg shadow hover:bg-brand-primary transition-colors text-sm font-medium">
                <ICONS.sparkles className="w-5 h-5 mr-2" />
                Генерирај материјали
              </button>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={handlePrev} 
                    disabled={!hasPrev}
                    className="flex items-center bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                    <ICONS.chevronRight className="w-5 h-5 rotate-180 mr-1" />
                    Претходен
                </button>
                <button 
                    onClick={handleNext} 
                    disabled={!hasNext}
                    className="flex items-center bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                    Следен
                    <ICONS.chevronRight className="w-5 h-5 ml-1" />
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const TopicView: React.FC<TopicViewProps> = ({ id }) => {
  const { navigate } = useNavigation();
  const { getTopic, isLoading: curriculumIsLoading } = useCurriculum();
  const { showModal } = useModal();
  const [expandedConceptId, setExpandedConceptId] = useState<string | null>(null);
  const { addNotification } = useNotification();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedTopicData, setEditedTopicData] = useState<Topic | null>(null);
  const initializedIdRef = useRef<string | null>(null);

  const { grade, topic } = useMemo(() => getTopic(id), [getTopic, id]);

  useEffect(() => {
    // This effect ensures that the form is populated with the initial topic data
    // when the component mounts or the topic ID changes, but it prevents
    // subsequent background data fetches from overwriting user's edits.
    if (topic && initializedIdRef.current !== id) {
      setEditedTopicData(JSON.parse(JSON.stringify(topic)));
      initializedIdRef.current = id;
    }
  }, [topic, id]);

  const handleToggleConcept = (conceptId: string) => {
    setExpandedConceptId((prevId: string | null) => (prevId === conceptId ? null : conceptId));
  };
  
  const handleAssessmentStandardChange = useCallback((conceptId: string, index: number, newText: string) => {
    setEditedTopicData((prevTopic: Topic | null) => {
        if (!prevTopic) return null;
        const newConcepts = prevTopic.concepts.map((c: Concept) => {
            if (c.id === conceptId) {
                const newStandards = [...c.assessmentStandards];
                newStandards[index] = newText;
                return { ...c, assessmentStandards: newStandards };
            }
            return c;
        });
        return { ...prevTopic, concepts: newConcepts };
    });
  }, []);

  const handleActivitiesChange = useCallback((conceptId: string, newActivities: string[]) => {
    setEditedTopicData((prevTopic: Topic | null) => {
        if (!prevTopic) return null;
        const newConcepts = prevTopic.concepts.map((c: Concept) => {
            if (c.id === conceptId) {
                return { ...c, activities: newActivities };
            }
            return c;
        });
        return { ...prevTopic, concepts: newConcepts };
    });
  }, []);

  const handleSaveChanges = () => {
    console.log("Saving changes:", editedTopicData);
    addNotification('Промените се зачувани (симулација).', 'success');
    setIsEditing(false);
  };
  
  const handleCancelEdit = () => {
    if (topic) setEditedTopicData(JSON.parse(JSON.stringify(topic)));
    setIsEditing(false);
  };

  if (curriculumIsLoading) {
    return (
        <div className="p-8">
            <div className="animate-pulse">
                <div className="h-10 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-8"></div>
                <Card><div className="h-64 bg-gray-200 rounded"></div></Card>
            </div>
        </div>
    );
  }

  if (!topic || !grade) {
    return <div className="p-8 text-center text-red-500">Темата не е пронајдена.</div>;
  }
  
  const currentTopicData = isEditing ? editedTopicData : topic;
  const concepts = currentTopicData?.concepts || [];

  return (
    <div className="p-8 animate-fade-in">
      <header className="mb-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start">
            <div>
                <h1 className="text-4xl font-bold text-brand-primary"><MathRenderer text={topic.title} /></h1>
                <p className="text-xl text-gray-500">{grade.title}</p>
                <p className="text-md text-gray-600 mt-2 max-w-3xl"><MathRenderer text={topic.description} /></p>
            </div>
            <div className="flex gap-2 flex-shrink-0 mt-4 md:mt-0 self-end md:self-auto">
                {isEditing ? (
                    <>
                        <button onClick={handleCancelEdit} className="flex items-center bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                            <ICONS.close className="w-5 h-5 mr-2" /> Откажи
                        </button>
                        <button onClick={handleSaveChanges} className="flex items-center bg-green-600 text-white px-3 py-2 rounded-lg shadow hover:bg-green-700 transition-colors text-sm font-medium">
                            <ICONS.check className="w-5 h-5 mr-2" /> Зачувај
                        </button>
                    </>
                ) : (
                    <>
                         <button onClick={() => navigate(`/mindmap/${topic.id}`)} className="flex items-center bg-purple-100 text-purple-800 px-3 py-2 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium">
                            <ICONS.mindmap className="w-5 h-5 mr-2" /> Мисловна Мапа
                        </button>
                        <button onClick={() => setIsEditing(true)} className="flex items-center bg-blue-100 text-blue-800 px-3 py-2 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium">
                            <ICONS.edit className="w-5 h-5 mr-2" /> Уреди
                        </button>
                    </>
                )}
            </div>
        </div>
      </header>

      <Card>
        <h2 className="text-2xl font-semibold text-brand-primary mb-4">Поими во оваа тема</h2>
        {concepts.map((concept: Concept) => (
          <ConceptCard
            key={concept.id}
            concept={concept}
            allConceptsInTopic={concepts}
            gradeLevel={grade.level}
            topicId={topic.id}
            isExpanded={expandedConceptId === concept.id}
            onToggle={handleToggleConcept}
            navigate={navigate}
            isEditing={isEditing}
            onAssessmentStandardChange={handleAssessmentStandardChange}
            onActivitiesChange={handleActivitiesChange}
          />
        ))}
      </Card>
    </div>
  );
};
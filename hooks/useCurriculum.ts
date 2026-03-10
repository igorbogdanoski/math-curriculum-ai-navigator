
import React, { createContext, useContext, useMemo, useCallback, useState, useEffect } from 'react';
import type { Curriculum, VerticalProgressionAnalysis, Concept, ConceptProgression, Grade, Topic, NationalStandard } from '../types';
import type { CurriculumModule } from '../data/curriculum';
import { firestoreService } from '../services/firestoreService';
import { useNotification } from '../contexts/NotificationContext';
import { fetchCurriculumOverrides, type CurriculumOverridesDoc } from '../services/firestoreService.curriculumOverrides';

interface ConceptChainEntry { grade: Grade; topic: Topic; concept: Concept; }

interface CurriculumContextType {
    curriculum: Curriculum | undefined;
    verticalProgression: VerticalProgressionAnalysis | undefined;
    allNationalStandards: NationalStandard[] | undefined;
    isLoading: boolean;
    error: string | null;
    getGrade: (gradeId: string) => Grade | undefined;
    getTopic: (topicId: string) => { grade?: Grade; topic?: Topic };
    getConceptDetails: (conceptId: string) => { grade?: Grade; topic?: Topic; concept?: Concept };
    getStandardsByIds: (ids: string[] | undefined) => NationalStandard[];
    findConceptAcrossGrades: (conceptId: string) => ConceptProgression | undefined;
    getConceptChain: (conceptId: string) => { priors: ConceptChainEntry[]; futures: ConceptChainEntry[] };
    allConcepts: (Concept & { gradeLevel: number; topicId: string; })[];
}

const CurriculumContext = createContext<CurriculumContextType | undefined>(undefined);

export const useCurriculum = () => {
  const context = useContext(CurriculumContext);
  if (!context) {
    throw new Error('useCurriculum must be used within a CurriculumProvider');
  }
  return context;
};

export const CurriculumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [data, setData] = useState<CurriculumModule | null>(null);
    const [overrides, setOverrides] = useState<CurriculumOverridesDoc | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { addNotification } = useNotification();

    useEffect(() => {
        let cancelled = false;

        // 1. Load local curriculum data (code-split into its own chunk)
        import('../data/curriculum').then(({ fullCurriculumData }) => {
            if (!cancelled) {
                setData(fullCurriculumData);
                setIsLoading(false);
            }
        });

        // 2. Load curriculum overrides added by school admin via CurriculumEditorView
        // Uses a well-known "school" key — overrides are school-wide, not per-teacher.
        // Silent failure: local data always works as fallback.
        fetchCurriculumOverrides('school_overrides').then(doc => {
            if (!cancelled && doc) setOverrides(doc);
        }).catch(() => { /* silent — overrides are optional */ });

        return () => { cancelled = true; };
    }, []); // Dependency array empty to run only on mount

    // Merge curriculum overrides (custom concepts/topics added via CurriculumEditorView)
    const curriculum = useMemo((): Curriculum | undefined => {
        if (!data?.curriculumData) return undefined;
        if (!overrides || (overrides.addedConcepts.length === 0 && overrides.addedTopics.length === 0)) {
            return data.curriculumData;
        }
        // Deep-clone grades to avoid mutating static data
        const grades = data.curriculumData.grades.map(grade => ({
            ...grade,
            topics: grade.topics.map(topic => ({ ...topic, concepts: [...topic.concepts] })),
        }));
        // Inject custom concepts into their target topics
        for (const addition of overrides.addedConcepts) {
            const grade = grades.find(g => g.id === addition.gradeId);
            if (!grade) continue;
            const topic = grade.topics.find(t => t.id === addition.topicId);
            if (!topic) continue;
            // Avoid duplicates on hot-reload
            if (!topic.concepts.find(c => c.id === addition.concept.id)) {
                topic.concepts.push(addition.concept as any);
            }
        }
        // Inject custom topics into their target grades
        for (const topicAdd of overrides.addedTopics) {
            const grade = grades.find(g => g.id === topicAdd.gradeId);
            if (!grade) continue;
            if (!grade.topics.find(t => t.id === topicAdd.topic.id)) {
                grade.topics.push(topicAdd.topic as any);
            }
        }
        return { grades };
    }, [data, overrides]);
    const verticalProgression = useMemo(() => data?.verticalProgressionData, [data]);
    const allNationalStandards = useMemo(() => {
        if (!data) return undefined;
        let standards = [...(data.nationalStandardsData || [])];
        
        // Dynamically extract assessmentStandards for grades 1-5
        if (data.curriculumData?.grades) {
             data.curriculumData.grades?.forEach((grade) => {
                 if (grade.level >= 1 && grade.level <= 5) {
                     grade.topics?.forEach((topic) => {
                         topic.concepts?.forEach((concept) => {
                             if (concept.assessmentStandards) {
                                 concept.assessmentStandards?.forEach((stdText, idx) => {
                                     const existing = standards.find(s => s.description === stdText && s.gradeLevel === grade.level);
                                     if (!existing) {
                                         standards.push({
                                             id: `M-${grade.level}-dyn-${concept.id}-${idx}`,
                                             code: `${grade.title}`,
                                             description: stdText,
                                             gradeLevel: grade.level,
                                             category: 'Математика',
                                             relatedConceptIds: [concept.id]
                                         });
                                     } else if (existing.relatedConceptIds && !existing.relatedConceptIds.includes(concept.id)) {
                                         existing.relatedConceptIds.push(concept.id);
                                     }
                                 });
                             }
                         });
                     });
                 }
             });
        }
        
        return standards.sort((a,b) => (a.gradeLevel || 0) - (b.gradeLevel || 0));
    }, [data]);

    const gradeMap = useMemo(() => {
        if (!curriculum) return new Map();
        const map = new Map<string, Grade>();
        curriculum.grades?.forEach((grade: Grade) => {
            map.set(grade.id, grade);
        });
        return map;
    }, [curriculum]);

    const topicMap = useMemo(() => {
        if (!curriculum) return new Map();
        const map = new Map<string, { grade: Grade; topic: Topic }>();
        curriculum.grades?.forEach((grade: Grade) => {
            grade.topics?.forEach((topic: Topic) => {
                map.set(topic.id, { grade, topic });
            });
        });
        return map;
    }, [curriculum]);

    const conceptMap = useMemo(() => {
        if (!curriculum) return new Map<string, { grade: Grade; topic: Topic; concept: Concept }>();
        const map = new Map<string, { grade: Grade; topic: Topic; concept: Concept }>();
        curriculum.grades?.forEach((grade: Grade) => {
            grade.topics?.forEach((topic: Topic) => {
                topic.concepts?.forEach((concept: Concept) => {
                    map.set(concept.id, { grade, topic, concept });
                });
            });
        });
        return map;
    }, [curriculum]);
    
    const nationalStandardMap = useMemo(() => {
        if (!allNationalStandards) return new Map();
        const map = new Map<string, NationalStandard>();
        (allNationalStandards || []).forEach((std: NationalStandard) => {
          map.set(std.id, std);
        });
        return map;
      }, [allNationalStandards]);

    const getGrade = useCallback((gradeId: string): Grade | undefined => {
        return gradeMap.get(gradeId);
    }, [gradeMap]);

    const getTopic = useCallback((topicId: string): { grade?: Grade; topic?: Topic } => {
        return topicMap.get(topicId) || {};
    }, [topicMap]);

    const getConceptDetails = useCallback((conceptId: string): { grade?: Grade; topic?: Topic; concept?: Concept } => {
        return conceptMap.get(conceptId) || {};
    }, [conceptMap]);
    
    const getStandardsByIds = useCallback((ids: string[] | undefined): NationalStandard[] => {
        if (!ids || !Array.isArray(ids) || ids.length === 0 || !nationalStandardMap.size) return [];
        return ids.map(id => nationalStandardMap.get(id)).filter((std): std is NationalStandard => !!std);
      }, [nationalStandardMap]);
      
    const allConcepts = useMemo(() => {
        if (!curriculum) return [];
        return (curriculum.grades || []).flatMap((grade: Grade) => 
            (grade.topics || []).flatMap((topic: Topic) => 
                (topic.concepts || []).map((concept: Concept) => ({
                    ...concept,
                    gradeLevel: grade.level,
                    topicId: topic.id
                }))
            )
        );
    }, [curriculum]);

    const getConceptChain = useCallback((conceptId: string): { priors: ConceptChainEntry[]; futures: ConceptChainEntry[] } => {
        const entry = conceptMap.get(conceptId);
        if (!entry) return { priors: [], futures: [] };

        // Predecessors: concepts this one explicitly depends on
        const priors = (entry.concept.priorKnowledgeIds || [])
            .map((id: string) => conceptMap.get(id) as ConceptChainEntry | undefined)
            .filter((r): r is ConceptChainEntry => r !== undefined);

        // Successors: concepts anywhere in the curriculum that list this one as a prerequisite
        const futures = allConcepts
            .filter((c) => (c.priorKnowledgeIds || []).includes(conceptId))
            .map((c) => conceptMap.get(c.id) as ConceptChainEntry | undefined)
            .filter((r): r is ConceptChainEntry => r !== undefined);

        return { priors, futures };
    }, [conceptMap, allConcepts]);

    const findConceptAcrossGrades = useCallback((conceptId: string): ConceptProgression | undefined => {
        if (!curriculum || allConcepts.length === 0) return undefined;

        const initialConcept = allConcepts.find((c: Concept & { gradeLevel: number; topicId: string }) => c.id === conceptId);
        if (!initialConcept) return undefined;

        const baseTitle = initialConcept.title.replace(/Вовед во |Операции со |Основи на /i, '').trim();

        const progression: Array<{ grade: number; concept: Concept }> = allConcepts
            .filter((c: Concept & { gradeLevel: number; topicId: string }) => c.title.replace(/Вовед во |Операции со |Основи на /i, '').trim() === baseTitle)
            .map((c: Concept & { gradeLevel: number; topicId: string }) => ({
                grade: c.gradeLevel,
                concept: c,
            }));
        
        if (progression.length > 0) {
            return { 
                conceptId: conceptId,
                title: baseTitle, 
                progression: progression.sort((a, b) => a.grade - b.grade) 
            };
        }

        return undefined;
    }, [curriculum, allConcepts]);
    
    const value = {
        curriculum,
        verticalProgression,
        allNationalStandards,
        isLoading,
        error,
        getGrade,
        getTopic,
        getConceptDetails,
        getStandardsByIds,
        findConceptAcrossGrades,
        getConceptChain,
        allConcepts
    };

    return React.createElement(CurriculumContext.Provider, { value: value }, children);
};

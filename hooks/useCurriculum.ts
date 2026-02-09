
import React, { createContext, useContext, useMemo, useCallback, useState, useEffect } from 'react';
import type { Curriculum, VerticalProgressionAnalysis, Concept, ConceptProgression, Grade, Topic, NationalStandard } from '../types';
import { firestoreService } from '../services/firestoreService';
import { type CurriculumModule, fullCurriculumData as localCurriculumData } from '../data/curriculum';
import { useNotification } from '../contexts/NotificationContext';

interface CurriculumContextType {
    curriculum: Curriculum | undefined;
    verticalProgression: VerticalProgressionAnalysis | undefined;
    allNationalStandards: NationalStandard[] | undefined;
    isLoading: boolean;
    error: string | null;
    getGrade: (gradeId: string) => Grade | undefined;
    getTopic: (topicId: string) => { grade?: Grade; topic?: Topic };
    getConceptDetails: (conceptId: string) => { grade?: Grade; topic?: Topic; concept?: Concept };
    getStandardsByIds: (ids: string[]) => NationalStandard[];
    findConceptAcrossGrades: (conceptId: string) => ConceptProgression | undefined;
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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { addNotification } = useNotification();

    useEffect(() => {
        // 1. Immediately load local data to ensure the app is responsive instantly (Optimistic UI)
        // This guarantees the user never sees an empty screen even if offline.
        setData(localCurriculumData);
        setIsLoading(false);

        // 2. Background Sync with Firestore
        const syncWithFirestore = async () => {
            try {
                const remoteModule = await firestoreService.fetchFullCurriculum();
                
                // CRITICAL STABILITY CHECK:
                // Only overwrite local data if the remote data is strictly valid and contains content.
                // This prevents a "bad deployment" or empty DB from breaking the live app.
                const isValid = remoteModule && 
                                remoteModule.curriculumData && 
                                Array.isArray(remoteModule.curriculumData.grades) && 
                                remoteModule.curriculumData.grades.length > 0;

                if (isValid) {
                    setData(remoteModule);
                    console.log("Curriculum data successfully synced with Firestore.");
                } else {
                    console.warn("Remote curriculum data was empty or invalid. Retaining local fallback data.");
                }
            } catch (err) {
                // Silent failure pattern: If remote fetch fails (offline, server error),
                // we intentionally do NOT block the user because we already have localData loaded.
                // We just log it for debugging.
                console.warn("Background sync failed (using local data):", err);
            }
        };

        syncWithFirestore();
    }, []); // Dependency array empty to run only on mount

    const curriculum = useMemo(() => data?.curriculumData, [data]);
    const verticalProgression = useMemo(() => data?.verticalProgressionData, [data]);
    const allNationalStandards = useMemo(() => data?.nationalStandardsData, [data]);

    const gradeMap = useMemo(() => {
        if (!curriculum) return new Map();
        const map = new Map<string, Grade>();
        curriculum.grades.forEach(grade => {
            map.set(grade.id, grade);
        });
        return map;
    }, [curriculum]);

    const topicMap = useMemo(() => {
        if (!curriculum) return new Map();
        const map = new Map<string, { grade: Grade; topic: Topic }>();
        curriculum.grades.forEach(grade => {
            grade.topics.forEach(topic => {
                map.set(topic.id, { grade, topic });
            });
        });
        return map;
    }, [curriculum]);

    const conceptMap = useMemo(() => {
        if (!curriculum) return new Map();
        const map = new Map<string, { grade: Grade; topic: Topic; concept: Concept }>();
        curriculum.grades.forEach(grade => {
            grade.topics.forEach(topic => {
                topic.concepts.forEach(concept => {
                    map.set(concept.id, { grade, topic, concept });
                });
            });
        });
        return map;
    }, [curriculum]);
    
    const nationalStandardMap = useMemo(() => {
        if (!allNationalStandards) return new Map();
        const map = new Map<string, NationalStandard>();
        allNationalStandards.forEach(std => {
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
    
    const getStandardsByIds = useCallback((ids: string[]): NationalStandard[] => {
        if (!nationalStandardMap.size) return [];
        return ids.map(id => nationalStandardMap.get(id)).filter((std): std is NationalStandard => !!std);
      }, [nationalStandardMap]);
      
    const allConcepts = useMemo(() => {
        if (!curriculum) return [];
        return curriculum.grades.flatMap(grade => 
            grade.topics.flatMap(topic => 
                topic.concepts.map(concept => ({
                    ...concept,
                    gradeLevel: grade.level,
                    topicId: topic.id
                }))
            )
        );
    }, [curriculum]);

    const findConceptAcrossGrades = useCallback((conceptId: string): ConceptProgression | undefined => {
        if (!curriculum || allConcepts.length === 0) return undefined;

        const initialConcept = allConcepts.find(c => c.id === conceptId);
        if (!initialConcept) return undefined;

        const baseTitle = initialConcept.title.replace(/Вовед во |Операции со |Основи на /i, '').trim();

        const progression: Array<{ grade: number; concept: Concept }> = allConcepts
            .filter(c => c.title.replace(/Вовед во |Операции со |Основи на /i, '').trim() === baseTitle)
            .map(c => ({
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
        allConcepts
    };

    return React.createElement(CurriculumContext.Provider, { value: value }, children);
};

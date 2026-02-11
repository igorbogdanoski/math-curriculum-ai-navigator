import { useState, useEffect } from 'react';
import { usePlanner } from '../contexts/PlannerContext';
import { useAuth } from '../contexts/AuthContext';
import { useCurriculum } from './useCurriculum';
import { geminiService } from '../services/geminiService';
import type { PlannerItem, LessonPlan, Concept } from '../types';

export interface Suggestion {
  id: string;
  text: string;
  target: {
    concept: Concept;
    grade: number;
    topicId: string;
  };
}

export function useProactiveSuggestions() {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { items, getLessonPlan } = usePlanner();
  const { getConceptDetails } = useCurriculum();
  const { user } = useAuth();

  useEffect(() => {
    const findAndGenerateSuggestion = async () => {
      // Don't run suggestions if not logged in
      if (!user) {
        setIsLoading(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const upcomingItems = items.filter((item: PlannerItem) => {
        const itemDate = new Date(item.date);
        return itemDate >= today && itemDate <= nextWeek;
      });

      let triggerItem: PlannerItem | undefined;
      let triggerPlan: LessonPlan | undefined;
      let triggerConcept: Concept | undefined;

      for (const item of upcomingItems) {
        if (item.lessonPlanId) {
          const plan = getLessonPlan(item.lessonPlanId);
          if (plan) {
            for (const conceptId of plan.conceptIds) {
              const { concept } = getConceptDetails(conceptId);
              // Trigger based on concept title for robustness
              if (concept && concept.title.toLowerCase().includes('питагорова теорема')) {
                triggerItem = item;
                triggerPlan = plan;
                triggerConcept = concept;
                break;
              }
            }
          }
        }
        if (triggerItem) break;
      }

      if (triggerItem && triggerPlan && triggerConcept) {
        const suggestionId = `suggestion-${triggerItem.id}`;
        const isDismissed = sessionStorage.getItem(suggestionId);
        
        if (!isDismissed) {
          // Check localStorage for recently generated text for THIS trigger
          const cacheKey = `cached-${suggestionId}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
             try {
                const { text, timestamp } = JSON.parse(cached);
                // 24 hour cache for the same suggestion text
                if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
                   setSuggestion({
                      id: suggestionId,
                      text: text,
                      target: {
                        concept: triggerConcept,
                        grade: triggerPlan.grade,
                        topicId: triggerPlan.topicId,
                      }
                    });
                    setIsLoading(false);
                    return;
                }
             } catch(e) { localStorage.removeItem(cacheKey); }
          }

          try {
            const suggestionText = await geminiService.generateProactiveSuggestion(triggerConcept, user);
            setSuggestion({
              id: suggestionId,
              text: suggestionText,
              target: {
                concept: triggerConcept,
                grade: triggerPlan.grade,
                topicId: triggerPlan.topicId,
              }
            });
            // Cache it
            localStorage.setItem(cacheKey, JSON.stringify({
                text: suggestionText,
                timestamp: Date.now()
            }));
          } catch (error) {
            console.error("Failed to generate proactive suggestion:", error);
            setSuggestion(null);
          }
        } else {
             setSuggestion(null);
        }
      } else {
         setSuggestion(null);
      }
      setIsLoading(false);
    };

    // Delay execution significantly to avoid race with recommendations
    const timer = setTimeout(findAndGenerateSuggestion, 2500);

    return () => clearTimeout(timer);
  }, [user?.uid, items.length]); // Minimal dependencies to prevent re-runs

  const dismissSuggestion = () => {
    if (suggestion) {
      sessionStorage.setItem(suggestion.id, 'true');
      setSuggestion(null);
    }
  };

  return { suggestion, isLoading, dismissSuggestion };
}
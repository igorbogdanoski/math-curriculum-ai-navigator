import type { LessonPlan, SharedAnnualPlan } from '../types';

declare const pako: any; // pako is loaded from a script tag in index.html

export const shareService = {
  generateShareData(lessonPlan: LessonPlan): string {
    try {
      const jsonString = JSON.stringify(lessonPlan);
      return btoa(encodeURIComponent(jsonString));
    } catch (error) {
      console.error("Error generating share data:", error);
      return '';
    }
  },
  
  decodeShareData(data: string): Omit<LessonPlan, 'id'> | null {
    try {
      const jsonString = decodeURIComponent(atob(data));
      const plan = JSON.parse(jsonString) as LessonPlan;
      
      if (plan && plan.id && plan.title && Array.isArray(plan.objectives)) {
          const { id, ...planWithoutId } = plan;
          return planWithoutId;
      }
      return null;
    } catch (error) {
      console.error("Error decoding share data:", error);
      return null;
    }
  },
  
  generateAnnualShareData(planData: SharedAnnualPlan): string {
    try {
      if (typeof pako === 'undefined') {
        throw new Error("Pako compression library is not loaded.");
      }
      const jsonString = JSON.stringify(planData);
      const compressed = pako.deflate(jsonString, { to: 'string' });
      return btoa(compressed);
    } catch (error) {
      console.error("Error generating annual share data:", error);
      return '';
    }
  },
  
  decodeAnnualShareData(data: string): SharedAnnualPlan | null {
    try {
      if (typeof pako === 'undefined') {
        throw new Error("Pako compression library is not loaded.");
      }
      const compressedString = atob(data);
      const jsonString = pako.inflate(compressedString, { to: 'string' });
      const planData = JSON.parse(jsonString) as SharedAnnualPlan;

      if (planData && Array.isArray(planData.items) && Array.isArray(planData.lessonPlans)) {
        return planData;
      }
      return null;
    } catch (error) {
      console.error("Error decoding annual share data:", error);
      return null;
    }
  }
};
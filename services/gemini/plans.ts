import { Type, Part, Content, getCached, setCached, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, buildDynamicSystemInstruction, JSON_SYSTEM_INSTRUCTION, minifyContext } from './core';
import { Concept, Topic, Grade, TeachingProfile, LessonPlan, PlannerItem, AIGeneratedIdeas, AIGeneratedThematicPlan, GenerationContext } from '../../types';
import { AIGeneratedIdeasSchema, AnnualPlanSchema, AIGeneratedThematicPlanSchema } from '../../utils/schemas';

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { CACHE_COLLECTION } from './core';

export const plansAPI = {
async generateLessonPlanIdeas(concepts: Concept[], topic: Topic, gradeLevel: number, profile?: TeachingProfile, options?: { focus: string; tone: string; learningDesign?: string; }, customInstruction?: string): Promise<AIGeneratedIdeas> {
    const conceptId = concepts?.[0]?.id || 'no_concept';
    const cacheKey = `ideas_${conceptId}_g${gradeLevel}`;
    // Skip cache when custom instruction is provided — user wants specific generation, not community cache
    if (!customInstruction) {
      try {
          const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
          if (cachedDoc.exists()) return cachedDoc.data().content as AIGeneratedIdeas;
      } catch (e) { console.warn("Cache read error:", e); }
    }

    const conceptList = concepts.map(c => c.title).join(', ');
    const topicTitle = topic?.title || "Општа математичка тема";
    let prompt = `Генерирај идеи за час на македонски јазик. Контекст: Одделение ${gradeLevel}, Тема: ${topicTitle}. Поими: ${conceptList}.`;
    if (customInstruction) prompt += `\nДополнителна инструкција: ${customInstruction}`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            openingActivity: { type: Type.STRING },
            mainActivity: { 
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING },
                        bloomsLevel: { type: Type.STRING, enum: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'] }
                    },
                    required: ["text", "bloomsLevel"]
                }
            },
            differentiation: { type: Type.STRING },
            assessmentIdea: { type: Type.STRING },
        },
        required: ["title", "openingActivity", "mainActivity", "differentiation", "assessmentIdea"]
    };

    const systemInstr = await buildDynamicSystemInstruction(JSON_SYSTEM_INSTRUCTION, gradeLevel, conceptId, topic?.id);
    const result = await generateAndParseJSON<AIGeneratedIdeas>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedIdeasSchema, MAX_RETRIES, false, systemInstr);
    await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: result, type: 'ideas', conceptId, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    return result;
  },

async generateDetailedLessonPlan(context: GenerationContext, profile?: TeachingProfile, image?: { base64: string, mimeType: string }): Promise<Partial<LessonPlan>> {
      const prompt = `Генерирај детална подготовка за час на македонски јазик.`;
      const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, objectives: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, bloomsLevel: { type: Type.STRING } }, required: ["text"] } }, scenario: { type: Type.OBJECT, properties: { introductory: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } }, main: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } }, concluding: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } } } }, required: ["title", "objectives", "scenario"] };
      const contents: Part[] = [{ text: prompt }, { text: `Контекст: ${JSON.stringify(minifyContext(context))}` }];
      if (image) contents.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
      const systemInstr = await buildDynamicSystemInstruction(JSON_SYSTEM_INSTRUCTION, context.grade?.level || 6, context.concepts?.[0]?.id, context.topic?.id);
      return generateAndParseJSON<Partial<LessonPlan>>(contents, schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false, systemInstr);
  },

async generateAnnualPlan(grade: Grade, startDate: string, endDate: string, holidays: string, winterBreak: {start: string, end: string}): Promise<Omit<PlannerItem, 'id'>[]> {
      const prompt = `Генерирај годишен распоред за ${grade.title}.`;
      const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { date: { type: Type.STRING }, title: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["date", "title"] } };
      return generateAndParseJSON<Omit<PlannerItem, 'id'>[]>([{ text: prompt }, { text: `Датуми: ${startDate} до ${endDate}` }], schema, DEFAULT_MODEL, AnnualPlanSchema);
  },

async generateThematicPlan(grade: Grade, topic: Topic): Promise<AIGeneratedThematicPlan> {
      const cacheKey = `thematic_${topic.id}_g${grade.level}`;
      try {
          const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
      const cached = await getCached<AIGeneratedThematicPlan>(cacheKey);
      if (cached) return cached;

      const prompt = `Генерирај тематски план за "${topic.title}" (${grade.level} одд.).`;
      const schema = { type: Type.OBJECT, properties: { thematicUnit: { type: Type.STRING }, lessons: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { lessonNumber: { type: Type.INTEGER }, lessonUnit: { type: Type.STRING }, learningOutcomes: { type: Type.STRING }, keyActivities: { type: Type.STRING }, assessment: { type: Type.STRING } }, required: ["lessonNumber", "lessonUnit"] } } }, required: ["thematicUnit", "lessons"] };
      const result = await generateAndParseJSON<AIGeneratedThematicPlan>([{ text: prompt }, { text: `Тема: ${topic.title}` }], schema, DEFAULT_MODEL, AIGeneratedThematicPlanSchema);
      await setCached(cacheKey, result, { type: 'thematicplan', gradeLevel: grade.level, topicId: topic.id });
      return result;
    } catch (error) {
      console.error('Error generating thematic plan:', error);
      throw error;
    }
  }
};

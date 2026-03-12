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
    
    // Advanced Prompt Engineering: Chain-of-Thought + Tree of Thoughts + Persona
    let prompt = `
### УЛОГА
Ти си врвен експерт за методика на наставата по математика со 20-годишно искуство во креирање иновативни сценарија за часови според најновите Кембриџ и национални стандарди.

### КОНТЕКСТ
- Одделение: ${gradeLevel}
- Тема: ${topicTitle}
- Клучни поими: ${conceptList}
${options?.focus ? `- Примарен фокус: ${options.focus}` : ''}
${options?.learningDesign ? `- Педагошки модел: ${options.learningDesign}` : ''}

### ПРЕД-ГЕНЕРИРАЧКА ЛОГИКА (Chain-of-Thought)
Пред да го дадеш финалниот JSON, размисли (интерно) за следниве чекори:
1. АНАЛИЗА: Кои се најчестите мисконцепции кај учениците за овие поими?
2. СТРАТЕГИЈА (Tree of Thoughts): Разгледај три различни пристапи (на пр. истражувачки, директна инструкција, игровен). Избери го оној кој е најсоодветен за оваа тема и возраст.
3. ПЛАНИРАЊЕ: Како активностите да водат од пониски (Паметење) кон повисоки (Креирање) нивоа на Блумовата таксономија?

### ИНСТРУКЦИИ ЗА СОДРЖИНА
- Биди екстремно креативен. Избегнувај генерички задачи.
- Вметни реални македонски контексти (денри, локални имиња, градови).
- ВКУПНО ВРЕМЕ: Планирај за наставен час од 40 минути.
- Секоја активност МОРА да биде детално објаснета "чекор-по-чекор".
- СТАНДАРДИ: Користи ги официјалните национални стандарди од контекстот.

### ФОРМАТ
Генерирај го сценариото СТРИКТНО според официјалниот JSON шаблон.
`;

    if (customInstruction) prompt += `\nДополнителна инструкција од наставникот: ${customInstruction}`;

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
            assessmentStandards: { type: Type.ARRAY, items: { type: Type.STRING } },
            concepts: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["title", "openingActivity", "mainActivity", "differentiation", "assessmentIdea", "assessmentStandards", "concepts"]
    };

    const systemInstr = await buildDynamicSystemInstruction(JSON_SYSTEM_INSTRUCTION, gradeLevel, conceptId, topic?.id);
    // Use Thinking model (gemini-3.1-pro-preview) for better pedagogical reasoning
    const result = await generateAndParseJSON<AIGeneratedIdeas>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedIdeasSchema, MAX_RETRIES, true, systemInstr);
    await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: result, type: 'ideas', conceptId, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    return result;
  },

async generateDetailedLessonPlan(context: GenerationContext, profile?: TeachingProfile, image?: { base64: string, mimeType: string }): Promise<Partial<LessonPlan>> {
      const topicTitle = context.topic?.title || "Општа тема";
      const gradeLevel = context.grade?.level || 6;
      
      const prompt = `
### УЛОГА
Ти си врвен експерт за методика на наставата по математика со долгогодишно искуство. Твоја задача е да креираш детална и професионална подготовка за час.

### КОНТЕКСТ
- Одделение: ${gradeLevel}
- Тема: ${topicTitle}
- Концепти: ${context.concepts?.map(c => c.title).join(', ')}

### ПРЕД-ГЕНЕРИРАЧКА ЛОГИКА (Chain-of-Thought)
1. АНАЛИЗА: Размисли за клучните математички вештини кои треба да се развијат.
2. ПЕДАГОГИЈА (Tree of Thoughts): Оцени дали е подобро да се користи дедуктивен или индуктивен пристап за оваа специфична единица. Избери го најефективниот.
3. СТРУКТУРА: Осигурај се дека воведот ги мотивира учениците, главниот дел е прогресивен, а заклучокот го проверува наученото.

### ИНСТРУКЦИИ ЗА СОДРЖИНА
- Користи ја ОФИЦИЈАЛНАТА МАКЕДОНСКА СТРУКТУРА за сценарио.
- ВКУПНО ВРЕМЕ: Часот трае ТОЧНО 40 минути. Распредели го времето соодветно (пр. 5-10 мин вовед, 25 мин главна, 5-10 мин заклучок).
- Воведна активност: Јасен план со времетраење.
- Главна активност: Повеќестепени чекори со Блумова таксономија.
- Завршна активност: Сумирање и евалуација.
- Вклучи специфични македонски примери (денари, градови).
- СТАНДАРДИ И СОДРЖИНИ: Задолжително превземи ги и пополни ги колоните "Стандарди за оценување" и "Содржини (и поими)" директно од дадениот RAG контекст. Овие полиња НЕ СМЕАТ да бидат празни.
- СРЕДСТВА: Наведи конкретни наставни средства (табла, креда, дигитален уред, работен лист).
- СЛЕДЕЊЕ: Наведи конкретни методи за следење на напредокот (набљудување, прашања/одговори).
`;
      const schema = { 
          type: Type.OBJECT, 
          properties: { 
              title: { type: Type.STRING }, 
              subject: { type: Type.STRING }, 
              theme: { type: Type.STRING }, 
              objectives: { 
                  type: Type.ARRAY, 
                  items: { 
                      type: Type.OBJECT, 
                      properties: { 
                          text: { type: Type.STRING }, 
                          bloomsLevel: { type: Type.STRING, enum: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'] } 
                      }, 
                      required: ["text"] 
                  } 
              }, 
              scenario: { 
                  type: Type.OBJECT, 
                  properties: { 
                      introductory: { 
                          type: Type.OBJECT, 
                          properties: { 
                              text: { type: Type.STRING },
                              duration: { type: Type.STRING }
                          } 
                      }, 
                      main: { 
                          type: Type.ARRAY, 
                          items: { 
                              type: Type.OBJECT, 
                              properties: { 
                                  text: { type: Type.STRING },
                                  bloomsLevel: { type: Type.STRING }
                              } 
                          } 
                      }, 
                      concluding: { 
                          type: Type.OBJECT, 
                          properties: { 
                              text: { type: Type.STRING },
                              duration: { type: Type.STRING }
                          } 
                      } 
                  } 
              },
              assessmentStandards: { type: Type.ARRAY, items: { type: Type.STRING } },
              materials: { type: Type.ARRAY, items: { type: Type.STRING } },
              progressMonitoring: { type: Type.ARRAY, items: { type: Type.STRING } },
              differentiation: { type: Type.STRING },
              concepts: { 
                  type: Type.ARRAY, 
                  items: { 
                      type: Type.OBJECT, 
                      properties: { 
                          title: { type: Type.STRING } 
                      }, 
                      required: ["title"] 
                  } 
              }
          }, 
          required: ["title", "objectives", "scenario", "assessmentStandards", "concepts"] 
      };
      const contents: Part[] = [{ text: prompt }, { text: `Контекст: ${JSON.stringify(minifyContext(context))}` }];
      if (image) contents.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
      const systemInstr = await buildDynamicSystemInstruction(JSON_SYSTEM_INSTRUCTION, gradeLevel, context.concepts?.[0]?.id, context.topic?.id);
      
      // Use Thinking model for high-quality pedagogical planning
      return generateAndParseJSON<Partial<LessonPlan>>(contents, schema, DEFAULT_MODEL, undefined, MAX_RETRIES, true, systemInstr);
  },

async generateAnnualPlan(grade: Grade, startDate: string, endDate: string, holidays: string, winterBreak: {start: string, end: string}): Promise<Omit<PlannerItem, 'id'>[]> {
      const prompt = `
### УЛОГА
Ти си врвен стратешки планер во образованието. Твоја задача е да креираш ГОДИШЕН ПЛАН за наставата по математика.

### КОНТЕКСТ
- Одделение: ${grade.title}
- Период: ${startDate} до ${endDate}
- Празници и неработни денови: ${holidays}
- Зимски распуст: ${winterBreak.start} до ${winterBreak.end}

### ПРЕД-ГЕНЕРИРАЧКА ЛОГИКА (Chain-of-Thought)
1. КАЛЕНДАР: Прво идентификувај ги сите работни денови во периодот, исклучувајќи ги празниците и распустот.
2. ТЕМИ: Распредели ги главните теми (Броеви, Алгебра, Геометрија, Мерење, Работа со податоци) логично низ месеците.
3. БАЛАНС: Осигурај се дека има доволно часови за вежбање, повторување и формативно оценување по секоја тема.

### ИНСТРУКЦИИ ЗА СОДРЖИНА
- Секоја единица мора да има датум и јасен наслов.
- Внимавај на вертикалната прогресија — потешките теми не треба да дојдат одеднаш.
- Исходот треба да биде низа од настани кои формираат кохерентна целина за целата учебна година.
`;
      const schema = { 
          type: Type.ARRAY, 
          items: { 
              type: Type.OBJECT, 
              properties: { 
                  date: { type: Type.STRING }, 
                  title: { type: Type.STRING }, 
                  description: { type: Type.STRING } 
              }, 
              required: ["date", "title"] 
          } 
      };
      // Use Thinking model for complex calendar and curriculum alignment
      return generateAndParseJSON<Omit<PlannerItem, 'id'>[]>([{ text: prompt }, { text: `Датуми: ${startDate} до ${endDate}` }], schema, DEFAULT_MODEL, AnnualPlanSchema, MAX_RETRIES, true);
  },

async generateThematicPlan(grade: Grade, topic: Topic): Promise<AIGeneratedThematicPlan> {
      const cacheKey = `thematic_${topic.id}_g${grade.level}`;
      try {
          const cached = await getCached<AIGeneratedThematicPlan>(cacheKey);
          if (cached) return cached;

      const prompt = `
### УЛОГА
Ти си експерт за курикулум по математика. Креирај ТЕМАТСКО ПЛАНИРАЊЕ (Прилог 1) за конкретна тема.

### КОНТЕКСТ
- Одделение: ${grade.level}
- Тема: "${topic.title}"
- Поими во темата: ${topic.concepts.map(c => c.title).join(', ')}

### ПРЕД-ГЕНЕРИРАЧКА ЛОГИКА (Tree of Thoughts)
1. АНАЛИЗА НА ТЕМА: Кои се клучните стандарди за оценување според националната програма?
2. ПЕДАГОШКИ ПРИСТАП: Разгледај три опции за редослед на лекциите. Избери ја онаа која гради најцврста логичка основа.
3. ИНКЛУЗИВНОСТ: Како активностите ќе ги поддржат и талентираните и учениците со потешкотии?

### ИНСТРУКЦИИ ЗА СОДРЖИНА
- Пополни ги сите 6 клучни колони од официјалниот македонски шаблон.
- Активностите мора да бидат разновидни: индивидуални, во парови и групни.
- Следењето на напредокот мора да вклучува ФОРМАТИВНИ методи (портфолија, дискусии, набљудување).
- Колоната за СРЕДСТВА треба да содржи конкретни наставни помагала.
- Колоната за ЧАСОВИ треба да содржи број на часови за таа подтема.
`;
      const schema = { 
          type: Type.OBJECT, 
          properties: { 
              thematicUnit: { type: Type.STRING }, 
              lessons: { 
                  type: Type.ARRAY, 
                  items: { 
                      type: Type.OBJECT, 
                      properties: { 
                          lessonNumber: { type: Type.INTEGER }, 
                          lessonUnit: { type: Type.STRING }, 
                          learningOutcomes: { type: Type.STRING }, 
                          keyActivities: { type: Type.STRING }, 
                          assessment: { type: Type.STRING },
                          resources: { type: Type.STRING },
                          hours: { type: Type.INTEGER }
                      }, 
                      required: ["lessonNumber", "lessonUnit"] 
                  } 
              } 
          }, 
          required: ["thematicUnit", "lessons"] 
      };
      
      const systemInstr = await buildDynamicSystemInstruction(JSON_SYSTEM_INSTRUCTION, grade.level, undefined, topic.id);
      // Use Thinking model for structural curriculum mapping
      const result = await generateAndParseJSON<AIGeneratedThematicPlan>([{ text: prompt }, { text: `Тема: ${topic.title}` }], schema, DEFAULT_MODEL, AIGeneratedThematicPlanSchema, MAX_RETRIES, true, systemInstr);
      await setCached(cacheKey, result, { type: 'thematicplan', gradeLevel: grade.level, topicId: topic.id });
      return result;
    } catch (error) {
      console.error('Error generating thematic plan:', error);
      throw error;
    }
  },

  async regenerateLessonPlanSection(section: 'introductory' | 'main' | 'concluding', currentPlan: Partial<LessonPlan>, customInstruction?: string): Promise<any> {
    const sectionNames = {
        introductory: 'Воведна активност',
        main: 'Главни активности',
        concluding: 'Завршна активност'
    };

    const prompt = `
### УЛОГА
Ти си експерт за методичка ревизија. Твоја задача е да РЕГЕНЕРИРАШ само еден специфичен дел од постоечка подготовка за час.

### КОНТЕКСТ НА ПЛАНОТ
- Наслов: ${currentPlan.title}
- Одделение: ${currentPlan.grade}
- Тема: ${currentPlan.theme}
- Секција за регенерација: ${sectionNames[section]}

### БАРАЊЕ
Креирај НОВА и ПОДОБРА верзизо само за овој дел. Биди креативен и оригинален.
${customInstruction ? `ДОПОЛНИТЕЛНО БАРАЊЕ: ${customInstruction}` : ''}

### ПРЕД-ГЕНЕРИРАЧКА ЛОГИКА
1. Анализирај го тековниот план за да обезбедиш конзистентност со останатите делови.
2. Осигурај се дека новата активност е ангажирачка и цели кон предвидените стандарди.
`;

    const schema = section === 'main' 
        ? { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, bloomsLevel: { type: Type.STRING } }, required: ["text"] } }
        : { type: Type.OBJECT, properties: { text: { type: Type.STRING }, duration: { type: Type.STRING } }, required: ["text"] };

    const contents: Part[] = [{ text: prompt }];
    const systemInstr = await buildDynamicSystemInstruction(JSON_SYSTEM_INSTRUCTION, currentPlan.grade);
    
    return generateAndParseJSON<any>(contents, schema, DEFAULT_MODEL, undefined, MAX_RETRIES, true, systemInstr);
  }
};

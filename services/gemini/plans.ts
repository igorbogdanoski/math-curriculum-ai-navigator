import { Type, Part, Content, getCached, setCached, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, buildDynamicSystemInstruction, JSON_SYSTEM_INSTRUCTION, minifyContext, sanitizePromptInput } from './core';
import { Concept, Topic, Grade, TeachingProfile, LessonPlan, LessonScenario, PlannerItem, AIGeneratedIdeas, AIGeneratedThematicPlan, AIGeneratedPresentation, GenerationContext } from '../../types';
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
    // @prompt-start: lesson_ideas
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

    // @prompt-end: lesson_ideas
    const safeInstruction = sanitizePromptInput(customInstruction, 500);
    if (safeInstruction) prompt += `\nДополнителна инструкција од наставникот: ${safeInstruction}`;

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
    // Use high-quality model for better pedagogical reasoning
        const result = await generateAndParseJSON<AIGeneratedIdeas>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedIdeasSchema, MAX_RETRIES, true, systemInstr, profile?.tier);
        // Cache write must never block UI completion; generation result is already available.
        void setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: result, type: 'ideas', conceptId, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    return result;
  },

async generateDetailedLessonPlan(context: GenerationContext, profile?: TeachingProfile, image?: { base64: string, mimeType: string }): Promise<Partial<LessonPlan>> {
      const topicTitle = context.topic?.title || "Општа тема";
      const gradeLevel = context.grade?.level || 6;

      // @prompt-start: lesson_plan
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
      // @prompt-end: lesson_plan

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
      return generateAndParseJSON<Partial<LessonPlan>>(contents, schema, DEFAULT_MODEL, undefined, MAX_RETRIES, true, systemInstr, profile?.tier);
  },

async generateAnnualPlan(grade: Grade, startDate: string, endDate: string, holidays: string, winterBreak: {start: string, end: string}, profile?: TeachingProfile): Promise<Omit<PlannerItem, 'id'>[]> {
      // @prompt-start: annual_plan
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
      // @prompt-end: annual_plan
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
      return generateAndParseJSON<Omit<PlannerItem, 'id'>[]>([{ text: prompt }, { text: `Датуми: ${startDate} до ${endDate}` }], schema, DEFAULT_MODEL, AnnualPlanSchema, MAX_RETRIES, true, undefined, profile?.tier);
  },

async generateThematicPlan(grade: Grade, topic: Topic, profile?: TeachingProfile): Promise<AIGeneratedThematicPlan> {
      const cacheKey = `thematic_${topic.id}_g${grade.level}`;
      try {
          const cached = await getCached<AIGeneratedThematicPlan>(cacheKey);
          if (cached) return cached;

      // @prompt-start: thematic_plan
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
      // @prompt-end: thematic_plan
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
      const result = await generateAndParseJSON<AIGeneratedThematicPlan>([{ text: prompt }, { text: `Тема: ${topic.title}` }], schema, DEFAULT_MODEL, AIGeneratedThematicPlanSchema, MAX_RETRIES, true, systemInstr, profile?.tier);
      await setCached(cacheKey, result, { type: 'thematicplan', gradeLevel: grade.level, topicId: topic.id });
      return result;
    } catch (error) {
      console.error('Error generating thematic plan:', error);
      throw error;
    }
  },

  async regenerateLessonPlanSection(section: 'introductory' | 'main' | 'concluding', currentPlan: Partial<LessonPlan>, customInstruction?: string, profile?: TeachingProfile): Promise<LessonScenario['main'] | LessonScenario['introductory']> {
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
${sanitizePromptInput(customInstruction) ? `ДОПОЛНИТЕЛНО БАРАЊЕ: ${sanitizePromptInput(customInstruction)}` : ''}

### ПРЕД-ГЕНЕРИРАЧКА ЛОГИКА
1. Анализирај го тековниот план за да обезбедиш конзистентност со останатите делови.
2. Осигурај се дека новата активност е ангажирачка и цели кон предвидените стандарди.
`;

    const schema = section === 'main' 
        ? { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, bloomsLevel: { type: Type.STRING } }, required: ["text"] } }
        : { type: Type.OBJECT, properties: { text: { type: Type.STRING }, duration: { type: Type.STRING } }, required: ["text"] };

    const contents: Part[] = [{ text: prompt }];
    const systemInstr = await buildDynamicSystemInstruction(JSON_SYSTEM_INSTRUCTION, currentPlan.grade);
    
    return generateAndParseJSON<LessonScenario['main'] | LessonScenario['introductory']>(contents, schema, DEFAULT_MODEL, undefined, MAX_RETRIES, true, systemInstr, profile?.tier);
  },

  async generatePresentation(topic: string, gradeLevel: number, concepts: string[], customInstruction?: string, profile?: TeachingProfile, slideCount = 10): Promise<AIGeneratedPresentation> {
    const sanitized = sanitizePromptInput(customInstruction);
    const prompt = `
### УЛОГА
Ти си светски врвен дизајнер на едукативни математички презентации. Твојата задача е да креираш динамична, педагошки богата презентација за наставен час.

### КОНТЕКСТ
- Тема: ${topic}
- Одделение: ${gradeLevel}
- Клучни поими: ${concepts.join(', ')}
- Број на слајдови: ${slideCount} (строго)
${sanitized ? `- Дополнителни барања: ${sanitized}` : ''}

### СТРУКТУРА (задолжителен редослед, прилагоди бројот на слајдови на ${slideCount})
1. Насловен слајд (type='title') — атрактивен наслов + 1-2 тизер прашања
2. Цели на часот (type='content') — 3-4 мерливи исходи
3. Вовед / Мотивација (type='content') — реален контекст, зошто е важно
4. Разработка (2-4 слајди по потреба):
   - type='formula-centered' за дефиниции/теореми (content[0] = формула, content[1..] = белешки)
   - type='proof' за математички докази (content[] = чекори на доказот; линеарно откривање)
   - type='step-by-step' за алгоритми/постапки (секоја точка е нумериран чекор)
   - type='comparison' за споредба на концепти (content[] = лева страна, rightContent[] = десна страна; title укажува "А vs Б")
5. Практичен пример (type='example') — со детално решение
6. Задача за учениците (type='task') — со потполно решение
7. Проверка на разбирање (type='task' или 'example') — кратка задача
8. Заклучок / Рефлексија (type='summary')

### ПРАВИЛА ЗА СЕКОЈ СЛАЈД
- title: краток, привлечен наслов
- content: низа кратки точки (max 6); за 'formula-centered' content[0] е главната формула; за 'step-by-step' секоја точка е нумериран чекор; за 'proof' секоја точка е еден чекор на доказот
- rightContent: САМО за type='comparison' — паралелна листа за десна колона
- type: 'title'|'content'|'formula-centered'|'step-by-step'|'proof'|'comparison'|'example'|'task'|'summary'
- visualPrompt: English description of a simple math diagram (no text, dark background) for AI SVG generation
- solution: ЗАДОЛЖИТЕЛНО за type='task' и type='example' — детални чекори; НЕ вклучувај за останатите
- speakerNotes: белешки за наставникот (на македонски, 1-3 реченици; педагошки совет или временска насока)
- estimatedSeconds: препорачано траење на слајдот во секунди (60-300)

ВАЖНО — нови типови:
- type='proof': content[] ги листа чекорите на доказот (секоја точка = 1 чекор); visualPrompt = геометриска фигура или дијаграм
- type='comparison': content[] = листа за ЛЕВАТА колона; rightContent[] = листа за ДЕСНАТА колона; title = "Концепт А vs Концепт Б"
`;


    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        topic: { type: Type.STRING },
        gradeLevel: { type: Type.INTEGER },
        slides: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.ARRAY, items: { type: Type.STRING } },
              rightContent: { type: Type.ARRAY, items: { type: Type.STRING } },
              solution: { type: Type.ARRAY, items: { type: Type.STRING } },
              visualPrompt: { type: Type.STRING },
              speakerNotes: { type: Type.STRING },
              estimatedSeconds: { type: Type.INTEGER },
              type: { type: Type.STRING, enum: ['title', 'content', 'example', 'task', 'summary', 'step-by-step', 'formula-centered', 'comparison', 'proof'] }
            },
            required: ["title", "content", "type"]
          }
        }
      },
      required: ["title", "topic", "gradeLevel", "slides"]
    };

    const systemInstr = await buildDynamicSystemInstruction(JSON_SYSTEM_INSTRUCTION, gradeLevel);
    return generateAndParseJSON<AIGeneratedPresentation>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, true, systemInstr, profile?.tier);
  }
};

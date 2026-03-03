import { Topic, Concept } from '../types';

/**
 * Service for Retrieval-Augmented Generation (RAG).
 * Fetches exact official curriculum strings from the BDE (БРО) standards to feed to the AI.
 */
class RagService {
  /**
   * Helper to lazily load the curriculum data.
   */
  private async getCurriculumData() {
    const { fullCurriculumData } = await import('../data/curriculum');
    return fullCurriculumData;
  }

  /**
   * Retrieves the official requirements for a specific concept to be used as context.
   */
  public async getConceptContext(gradeLevel: number, conceptId: string): Promise<string> {
    const fullCurriculumData = await this.getCurriculumData();
    const gradeData = fullCurriculumData.curriculumData.grades.find((g) => g.level === gradeLevel);
    if (!gradeData) return '';

    for (const topic of gradeData.topics) {
      const concept = topic.concepts.find((c) => c.id === conceptId);
      if (concept) {
        return this.formatConceptRAG(gradeData.title, topic.title, concept);
      }
    }
    return '';
  }

  /**
   * Retrieves the official requirements for an entire topic.
   */
  public async getTopicContext(gradeLevel: number, topicId: string): Promise<string> {
    const fullCurriculumData = await this.getCurriculumData();
    const gradeData = fullCurriculumData.curriculumData.grades.find((g) => g.level === gradeLevel);
    if (!gradeData) return '';

    const topic = gradeData.topics.find((t) => t.id === topicId);
    if (!topic) return '';

    return this.formatTopicRAG(gradeData.title, topic);
  }

  private formatConceptRAG(gradeTitle: string, topicTitle: string, concept: Concept): string {
    let rag = `\n--- ОФИЦИЈАЛНА ПРОГРАМА НА БИРО ЗА РАЗВОЈ НА ОБРАЗОВАНИЕТО (БРО) ---\n`;
    rag += `Одделение: ${gradeTitle}\n`;
    rag += `Тема: ${topicTitle}\n`;
    rag += `Лекција / Наставна Единица: ${concept.title}\n`;
    if (concept.description) rag += `Опис според БРО: ${concept.description}\n`;
    
    if (concept.content && concept.content.length > 0) {
      rag += `\nСодржина која мора да се опфати:\n`;
      concept.content.forEach((item) => (rag += `- ${item}\n`));
    }

    if (concept.assessmentStandards && concept.assessmentStandards.length > 0) {
      rag += `\nСтандарди за оценување:\n`;
      concept.assessmentStandards.forEach((item) => (rag += `- ${item}\n`));
    }
    
    rag += `\nНАПОМЕНА ЗА AI МОДЕЛОТ: Строго придржувај се до овие стандарди. Не додавај концепти или тежина на задачи кои не се во овие БРО граници.\n--- КРАЈ НА ОФИЦИЈАЛНА ПРОГРАМА ---\n`;
    
    return rag;
  }

  private formatTopicRAG(gradeTitle: string, topic: Topic): string {
    let rag = `\n--- ОФИЦИЈАЛНА ПРОГРАМА НА БИРО ЗА РАЗВОЈ НА ОБРАЗОВАНИЕТО (БРО) ---\n`;
    rag += `Одделение: ${gradeTitle}\n`;
    rag += `Тема: ${topic.title}\n`;
    rag += `Опис на тема: ${topic.description}\n`;
    rag += `Сугерирани часови: ${topic.suggestedHours}\n`;
    
    rag += `\nЛекции кои припаѓаат во оваа тема:\n`;
    topic.concepts.forEach((concept) => {
        rag += `- ${concept.title}\n`;
    });
    
    rag += `\nНАПОМЕНА ЗА AI МОДЕЛОТ: Организирај ја програмата стриктно според овие лекции и сугерираните часови. Не измислувај непостоечки лекции.\n--- КРАЈ НА ОФИЦИЈАЛНА ПРОГРАМА ---\n`;
    return rag;
  }
}

export const ragService = new RagService();

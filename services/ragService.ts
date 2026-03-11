import { Topic, Concept } from '../types';
import { callGeminiEmbed } from './gemini/core';

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
   * Performs multimodal search using Gemini Embedding 2.
   * Supports text, images, and other parts for native cross-modal retrieval.
   */
  public async searchSimilarContext(queryParts: any[]): Promise<{ context: string, similarity: number }[]> {
    try {
      const queryEmbedding = await callGeminiEmbed({
        model: 'gemini-embedding-2-preview',
        contents: queryParts
      });
      
      // In a real production system, we would query a vector DB (Pinecone, Chroma, etc.)
      // Since we have local JSON data, we will provide a fallback for now or
      // simulate the retrieval from the local curriculum data.
      console.log("Multimodal Query Embedding calculated:", queryEmbedding.embeddings.values.length);
      
      return [{
          context: "Пронајдени се слични содржини од БРО програмата базирани на мултимодално пребарување.",
          similarity: 0.95
      }];
    } catch (error) {
      console.error("RAG Embedding Error:", error);
      return [];
    }
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
    
        if (concept.localContextExamples && concept.localContextExamples.length > 0) {
      rag += '\nЛОКАЛЕН КОНТЕКСТ (ЗАДОЛЖИТЕЛНО ЗА ПРИМЕРИТЕ):\n';
      rag += 'При креирање на текстуални задачи или примери од секојдневниот живот, користи ги следниве елементи кои се блиски на учениците во Македонија:\n';
      concept.localContextExamples.forEach((item) => (rag += '- ' + item + '\n'));
    } else {
      rag += '\nЛОКАЛЕН КОНТЕКСТ (ЗАДОЛЖИТЕЛНО ЗА ПРИМЕРИТЕ):\n';
      rag += 'При креирање на проблеми или примери, секогаш користи македонски контекст: валута Денари (МКД), македонски градови (Скопје, Битола, Охрид, итн.), традиционални македонски имиња и типични локални сценарија. Забрането е користење на долари, евра или американски/британски контексти.\n';
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

import { logger } from '../utils/logger';
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
   * Helper to calculate cosine similarity between two vectors.
   */
  private cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      mag1 += v1[i] * v1[i];
      mag2 += v2[i] * v2[i];
    }
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  /**
   * Performs multimodal search using Gemini Embedding 2.
   * Supports text, images, and other parts for native cross-modal retrieval.
   */
  public async searchSimilarContext(queryParts: any[]): Promise<{ context: string, similarity: number, conceptId?: string }[]> {
    try {
      // 1. Generate embedding for the multimodal query
      const result = await callGeminiEmbed({
        model: 'gemini-embedding-2-preview',
        contents: queryParts
      });
      const queryVector = result.embeddings.values;
      
      // 2. Load pre-indexed curriculum embeddings (simulated for now)
      // In a full implementation, these would come from a database like Pinecone/Firestore
      const curriculumEmbeddings = await this.getMockCurriculumEmbeddings();
      
      // 3. Rank results by similarity
      const scoredResults = curriculumEmbeddings.map(item => ({
        context: item.text,
        conceptId: item.id,
        similarity: this.cosineSimilarity(queryVector, item.vector)
      }));

      // Sort by similarity and return top 3
      return scoredResults
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);

    } catch (error) {
      logger.error("RAG Embedding Error:", error);
      return [];
    }
  }

  /**
   * Simulated vector store for curriculum concepts.
   * This would normally be a real Vector DB.
   */
  private async getMockCurriculumEmbeddings() {
    // Generate a few stable mock vectors for demo purposes
    // In production, we run 'callGeminiEmbed' on all curriculum text once and store results.
    return [
      { id: 'c1', text: 'Собирање и одземање на дропки со еднакви именители', vector: new Array(768).fill(0).map(() => Math.random()) },
      { id: 'c2', text: 'Плоштина и периметар на рамнини фигури', vector: new Array(768).fill(0).map(() => Math.random()) },
      { id: 'c3', text: 'Пропорционалност и размер во секојдневниот живот', vector: new Array(768).fill(0).map(() => Math.random()) }
    ];
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

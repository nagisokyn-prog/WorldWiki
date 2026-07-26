/**
 * @file chapter.service.ts
 * @description Сервис для управления главами
 * @rust-ready ✅ CRUD глав
 */

import { apiService } from './api.service';

interface ChapterData {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
  wordCount?: number;
  footnotes?: Record<string, unknown>;
  timelineEvents?: unknown[];
  participants?: string[];
  [key: string]: unknown;
}

class ChapterService {
  async list(project: string): Promise<ChapterData[]> {
    return await apiService.getChaptersList(project) as ChapterData[];
  }

  async get(project: string, id: string): Promise<ChapterData> {
    return await apiService.getChapter(project, id) as ChapterData;
  }

  async save(project: string, data: ChapterData): Promise<string> {
    if (!data.id) {
      data.id = `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    await apiService.saveChapter(project, data);
    return data.id;
  }

  async delete(project: string, id: string): Promise<{ success: boolean }> {
    return await apiService.deleteChapter(project, id);
  }

  createNew(title: string, content: string = '# Новая глава\n\nНачните писать ваше произведение...'): ChapterData {
    return {
      id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title || 'Новая глава',
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      wordCount: 0,
      footnotes: {},
      timelineEvents: [],
      participants: []
    };
  }

  async updateIndex(project: string): Promise<boolean> {
    return true;
  }
}

export const chapterService = new ChapterService();
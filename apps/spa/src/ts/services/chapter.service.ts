/**
 * @file chapter.service.ts
 * @description Сервис для управления главами
 * @rust-ready ✅ CRUD глав
 */

import * as api from './api.client';
import { projectRecordId } from './api/project.api';

import type { Chapter } from '../types/generated/Chapter';
import type { ChapterWithHierarchy } from '../stores/chapter.store';

class ChapterService {
  async list(project: string): Promise<Chapter[]> {
    return await api.getChapters(project) as Chapter[];
  }

  async get(project: string, id: string): Promise<Chapter> {
    return await api.getChapter(id) as Chapter;
  }

  async save(project: string, data: (Partial<Chapter> | Partial<ChapterWithHierarchy>) & Record<string, unknown>): Promise<string> {
    if (!data.id) {
      data.id = `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    if (!data.id.startsWith('chapters:')) {
      data.id = `chapters:${data.id}`;
    }
    data.project_id = projectRecordId(project);

    if (data.participants && Array.isArray(data.participants)) {
      data.participants = data.participants.map((p: any) => {
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object') {
          if (p.id) {
            return p.type && !p.id.includes(':') ? `${p.type}:${p.id}` : p.id;
          }
          return String(p);
        }
        return String(p);
      });
    }

    await api.saveChapter(data as unknown as Chapter);
    return data.id;
  }

  async delete(_project: string, id: string): Promise<{ success: boolean }> {
    await api.deleteChapter(id);
    return { success: true };
  }

  createNew(title: string, content: string = '# Новая глава\n\nНачните писать ваше произведение...'): ChapterWithHierarchy {
    return {
      id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      project_id: null,
      volume_id: '',
      title: title || 'Новая глава',
      content,
      sort_order: 0 as unknown as bigint,
      word_count: 0 as unknown as bigint,
      embeddings: {},
      timeline_events: [],
      participants: [],
      footnotes: {},
    };
  }

  async updateIndex(_project: string): Promise<boolean> {
    return true;
  }
}

export const chapterService = new ChapterService();

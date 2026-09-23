/**
 * @file chapter.service.ts
 * @description Сервис для управления главами
 * @rust-ready ✅ CRUD глав
 */

import * as api from './api.client';;

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
    data.project_id = project.startsWith('projects:') ? project : `projects:${project}`;

    // Rust бэкенд строго ожидает Option<Vec<String>> для participants
    if (Array.isArray(data.participants)) {
      data.participants = data.participants.map(p => {
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object') {
          const item = p as { id?: string; type?: string };
          if (item.id) {
            return (item.type && !item.id.includes(':')) ? `${item.type}:${item.id}` : item.id;
          }
        }
        return String(p);
      }).filter(Boolean);
    }

    await api.saveChapter(data as unknown as Chapter);
    return data.id;
  }

  async delete(_project: string, id: string): Promise<{ success: boolean }> {
    await api.deleteChapter(id);
    return { success: true };
  }

  createNew(title: string, content: string = '# Новая глава\n\nНачните писать ваше произведение...'): Chapter {
    return {
      id: `chapter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      project_id: null,
      title: title || 'Новая глава',
      content,
      summary: null,
      word_count: 0 as unknown as bigint,
      embeddings: {},
      footnotes: {},
      timeline_events: [] as unknown as Record<string, unknown>,
      participants: []
    };
  }

  async updateIndex(_project: string): Promise<boolean> {
    return true;
  }
}

export const chapterService = new ChapterService();
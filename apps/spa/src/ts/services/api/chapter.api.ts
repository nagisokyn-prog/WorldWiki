/**
 * @file chapter.api.ts
 * @description API-методы для работы с главами, иерархией и планами
 */

import { processIds, invoke, stringifyId } from '@worldwiki/components';
import { projectRecordId } from './project.api';
import type { Chapter } from '../../types/generated/Chapter';
import * as api from '../api.client';

export const chapterApi = {
  getChaptersList: async (project: string): Promise<Chapter[]> => {
    // Используем сгенерированный клиент:
    const list = await api.getChapters(project);
    return list.map(processIds).filter((c: any) => c);
  },

  getChapter: async (project: string, chapterId: string): Promise<Chapter> => {
    let c = await api.getChapter(chapterId);
    return processIds(c);
  },

  saveChapter: async (project: string, chapterData: any): Promise<{ success: boolean; id?: string }> => {
    const data = {
      ...chapterData,
      project_id: projectRecordId(project),
    };
    
    const res = await api.saveChapter(data as Chapter);

    if (data.arc_id || data.volume_id) {
      try {
        const rawChapterId = (data.id as string).replace(/^chapters:/, '');
        await api.assignChapter(
          project,
          rawChapterId,
          data.arc_id ?? null,
          data.volume_id ?? null
        );
      } catch (e) {
        console.warn('assign_chapter skipped:', e);
      }
    }

    if (data.content) {
      try {
        if (data.id) {
          await invoke<void>('save_text_blocks', { project, chapterId: data.id, html: data.content });
        }
      } catch (err) {
        console.error('Failed to parse text blocks:', err);
      }
    }

    return { success: true, id: res.id ? stringifyId(res.id) : data.id };
  },

  deleteChapter: (project: string, id: string): Promise<{ success: boolean }> =>
    invoke<{ success: boolean }>('delete_chapter', { id }),

  getChapterRevisions: (projectId: string, chapterId: string): Promise<any[]> =>
    invoke<any[]>('get_chapter_revisions', { project: projectId, chapterId }),

  toggleChapterHistoryPin: (historyId: string, isPinned: boolean): Promise<void> =>
    invoke<void>('toggle_chapter_history_pin', { historyId, isPinned }),

  // ═══════════════════════════════════════════════════════
  //  HIERARCHY: ТОМ-АРКА-ГЛАВА
  // ═══════════════════════════════════════════════════════

  async getHierarchy(project: string): Promise<{ volumes: any[]; arcs: any[]; chapters: Chapter[] }> {
    const data: any = await invoke('get_chapter_hierarchy', { project });
    if (data.volumes) data.volumes = data.volumes.map(processIds);
    if (data.arcs) data.arcs = data.arcs.map(processIds);
    if (data.chapters) data.chapters = data.chapters.map(processIds).filter((c: any) => c);
    return data;
  },

  async createVolume(project: string, title: string): Promise<string> {
    const res: any = await invoke('create_volume', { project, title });
    return stringifyId(res.id);
  },

  async updateVolume(project: string, id: string, title: string): Promise<void> {
    await invoke('update_volume', { project, id, title });
  },

  async deleteVolume(project: string, id: string): Promise<void> {
    await invoke('delete_volume', { project, id });
  },

  async createArc(project: string, title: string, volumeId?: string | null): Promise<string> {
    const res: any = await invoke('create_arc', { project, title, volumeId: volumeId ?? null });
    return stringifyId(res.id);
  },

  async updateArc(project: string, id: string, title: string, volumeId?: string | null): Promise<void> {
    await invoke('update_arc', { project, id, title, volumeId: volumeId ?? null });
  },

  async deleteArc(project: string, id: string): Promise<void> {
    await invoke('delete_arc', { project, id });
  },

  async assignChapter(project: string, chapterId: string, arcId?: string | null, volumeId?: string | null): Promise<void> {
    await invoke('assign_chapter', { project, chapterId, arcId: arcId ?? null, volumeId: volumeId ?? null });
  },

  async reorderNode(project: string, nodeType: string, id: string, sortOrder: number): Promise<void> {
    await invoke('reorder_node', { project, nodeType, id, sortOrder });
  },

  // ═══════════════════════════════════════════════════════
  //  PLAN ITEMS
  // ═══════════════════════════════════════════════════════

  async getPlanItems(project: string, parentType: string, parentId: string): Promise<any[]> {
    const allPlans = ((await invoke('get_plans', { project })) as any[]) || [];
    const cleanPlans = allPlans.map(processIds);
    const list = cleanPlans.filter((p: any) => p.parent_type === parentType && p.parent_ref === parentId);
    return list.map((p: any) => ({
      id: p.id,
      parentType: p.parent_type,
      parentId: p.parent_ref,
      text: p.title,
      done: p.completed,
      sort_order: p.sort_order
    })).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  async savePlanItem(project: string, item: {
    id?: string; parentType: string; parentId: string;
    text: string; done?: boolean; indent?: number; sort_order?: number;
  }): Promise<string> {
    const data = {
      id: item.id || null,
      project_id: projectRecordId(project),
      title: item.text,
      parent_ref: item.parentId,
      parent_type: item.parentType,
      sort_order: item.sort_order || 0,
      completed: item.done || false
    };
    const res: any = await invoke('save_plan', { data });
    return res.id;
  },

  async deletePlanItem(project: string, id: string): Promise<void> {
    await invoke('delete_plan', { id });
  },

  async togglePlanItem(project: string, id: string): Promise<boolean> {
    const plan: any = await invoke('get_plan', { id });
    if (plan) {
      plan.completed = !plan.completed;
      await invoke('save_plan', { data: plan });
      return plan.completed;
    }
    return false;
  },
};
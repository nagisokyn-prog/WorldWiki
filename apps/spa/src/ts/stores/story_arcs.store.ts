import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  getStoryArcs,
  saveStoryArc,
  deleteStoryArc,
  assignArcChapter,
  removeArcChapter,
  assignArcEntity,
  removeArcEntity,
  getArcChapters,
  getArcEntities
} from '../services/api.client';

export interface StoryArc {
  id?: string | null;
  project_id?: string | null;
  title: string;
  description?: string | null;
  arc_type: 'character' | 'event' | 'relationship' | 'theme' | string;
  status: 'planned' | 'in_progress' | 'completed' | 'abandoned' | string;
  color?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ArcChapterRelation {
  id?: string;
  in: string; // arc_id
  out: string; // chapter_id
  project_id: string;
  sort_order?: number;
  phase?: string | null; // 'setup' | 'escalation' | 'climax' | 'resolution'
}

export interface ArcEntityRelation {
  id?: string;
  in: string; // arc_id
  out: string; // entity_id
  project_id: string;
  role?: string | null; // 'protagonist' | 'antagonist' | 'subject'
}

export const useStoryArcsStore = defineStore('story_arcs', () => {
  const currentProject = ref<string | null>(null);
  const arcs = ref<StoryArc[]>([]);
  const arcChapters = ref<Map<string, ArcChapterRelation[]>>(new Map());
  const arcEntities = ref<Map<string, ArcEntityRelation[]>>(new Map());
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  async function loadArcs(project: string, force = false): Promise<StoryArc[]> {
    if (!force && arcs.value.length > 0 && currentProject.value === project) {
      return arcs.value;
    }
    currentProject.value = project;
    isLoading.value = true;
    error.value = null;
    try {
      const data = await getStoryArcs(project);
      arcs.value = Array.isArray(data) ? (data as unknown as StoryArc[]) : [];
      return arcs.value;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error.value = msg;
      console.error('[StoryArcsStore] Error loading arcs:', err);
      arcs.value = [];
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  async function saveArc(arc: StoryArc): Promise<StoryArc | null> {
    try {
      const payload: import('../types/generated/StoryArc').StoryArc = {
        id: arc.id ?? null,
        project_id: arc.project_id ?? currentProject.value ?? null,
        title: arc.title,
        description: arc.description ?? null,
        arc_type: arc.arc_type,
        status: arc.status,
        color: arc.color ?? null,
      };
      const savedId = await saveStoryArc(payload);
      const saved: StoryArc = {
        ...arc,
        id: savedId || arc.id,
      };
      const idx = arcs.value.findIndex(a => a.id === saved.id);
      if (idx !== -1) {
        arcs.value[idx] = saved;
      } else {
        arcs.value.push(saved);
      }
      return saved;
    } catch (err: unknown) {
      console.error('[StoryArcsStore] Error saving arc:', err);
      return null;
    }
  }

  async function removeArc(id: string): Promise<boolean> {
    try {
      await deleteStoryArc(id);
      arcs.value = arcs.value.filter(a => a.id !== id);
      arcChapters.value.delete(id);
      arcEntities.value.delete(id);
      return true;
    } catch (err: unknown) {
      console.error('[StoryArcsStore] Error deleting arc:', err);
      return false;
    }
  }

  async function loadBindings(arcId: string) {
    try {
      const [chData, entData] = await Promise.all([
        getArcChapters(arcId),
        getArcEntities(arcId)
      ]);
      arcChapters.value.set(arcId, Array.isArray(chData) ? (chData as unknown as ArcChapterRelation[]) : []);
      arcEntities.value.set(arcId, Array.isArray(entData) ? (entData as unknown as ArcEntityRelation[]) : []);
    } catch (err: unknown) {
      console.error('[StoryArcsStore] Error loading arc bindings:', err);
    }
  }

  async function bindChapter(rel: ArcChapterRelation): Promise<void> {
    await assignArcChapter(rel);
    const existing = arcChapters.value.get(rel.in) || [];
    existing.push(rel);
    arcChapters.value.set(rel.in, existing);
  }

  async function unbindChapter(arcId: string, chapterId: string): Promise<void> {
    await removeArcChapter(arcId, chapterId);
    const existing = arcChapters.value.get(arcId) || [];
    arcChapters.value.set(arcId, existing.filter(r => r.out !== chapterId));
  }

  async function bindEntity(rel: ArcEntityRelation): Promise<void> {
    await assignArcEntity(rel);
    const existing = arcEntities.value.get(rel.in) || [];
    existing.push(rel);
    arcEntities.value.set(rel.in, existing);
  }

  async function unbindEntity(arcId: string, entityId: string): Promise<void> {
    await removeArcEntity(arcId, entityId);
    const existing = arcEntities.value.get(arcId) || [];
    arcEntities.value.set(arcId, existing.filter(r => r.out !== entityId));
  }

  return {
    currentProject,
    arcs,
    arcChapters,
    arcEntities,
    isLoading,
    error,
    loadArcs,
    saveArc,
    removeArc,
    loadBindings,
    bindChapter,
    unbindChapter,
    bindEntity,
    unbindEntity,
  };
});

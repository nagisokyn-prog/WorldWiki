import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { chapterService } from '../services/chapter.service';
import { useTimelineStore } from './timeline.store';
import * as api from '../services/api.client';
import { useCalendarStore } from './calendar.store';
import type { Chapter } from '../types/generated/Chapter';

export type ChapterWithHierarchy = Chapter & {
  arc_id?: string | null;
  volume_id?: string | null;
  [key: string]: unknown;
};

export interface HierarchyVolume {
  id: string;
  title?: string;
  [key: string]: unknown;
}
export interface HierarchyArc {
  id: string;
  volume_id?: string | null;
  title?: string;
  [key: string]: unknown;
}
export interface ChapterHierarchy {
  volumes: HierarchyVolume[];
  arcs: HierarchyArc[];
  chapters: ChapterWithHierarchy[];
}

export const useChapterStore = defineStore('chapter', () => {
  const loading = ref(false);
  const chapters = ref<ChapterWithHierarchy[]>([]);
  const hierarchy = ref<ChapterHierarchy>({ volumes: [], arcs: [], chapters: [] });
  const currentChapterId = ref<string | undefined>(undefined);
  const currentChapter = ref<ChapterWithHierarchy | null>(null);
  const hasUnsavedChanges = ref(false);
  const debugError = ref<string | null>(null);
  const isSaving = ref(false);

  const currentChapterNode = computed(() => {
    if (!currentChapterId.value || !hierarchy.value.chapters) return null;
    const targetId = currentChapterId.value.normalize('NFC').trim();
    return hierarchy.value.chapters.find(c => {
      const cid = (typeof c.id === 'string' ? c.id : String(c.id)).normalize('NFC').trim();
      return cid === targetId;
    }) || null;
  });

  const currentArc = computed(() => {
    const ch = currentChapterNode.value;
    if (!ch || !ch.arc_id || !hierarchy.value.arcs) return null;
    return hierarchy.value.arcs.find(a => a.id === ch.arc_id) || null;
  });

  const currentVolume = computed(() => {
    const ch = currentChapterNode.value;
    let volId = ch?.volume_id;
    if (!volId && currentArc.value) {
      volId = currentArc.value.volume_id;
    }
    if (!volId || !hierarchy.value.volumes) return null;
    return hierarchy.value.volumes.find(v => v.id === volId) || null;
  });

  const loadChapters = async (project: string) => {
    try {
      console.log('📚 chapterStore.loadChapters: загружаю иерархию для проекта', project);
      loading.value = true;
      hierarchy.value = (await api.getChapterHierarchy(project)) as unknown as ChapterHierarchy;
      console.log('✅ chapterStore.loadChapters: иерархия загружена', hierarchy.value);
      debugError.value = null;
      loading.value = false;
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      console.error('❌ loadChapters ошибка:', err);
      debugError.value = `Ошибка загрузки иерархии: ${err}`;
      loading.value = false;
    }
  };

  const loadHierarchy = loadChapters;

  const saveChapter = async (project: string, emitFn?: (event: string, ...args: unknown[]) => void) => {
    if (!currentChapter.value || isSaving.value) return false;
    isSaving.value = true;

    const timelineStore = useTimelineStore();
    const autoParts = timelineStore.parseParticipants(currentChapter.value.content);
    const participantsList = (currentChapter.value.participants || []) as unknown as Array<{ id?: string; type?: string; autoParsed?: boolean; [key: string]: unknown }>;
    autoParts.forEach(p => {
      if (!participantsList.some((ep) => ep.id === p.id && ep.type === p.type)) {
        participantsList.push({ ...p, autoParsed: true });
      }
    });
    currentChapter.value.participants = participantsList as unknown as string[];

    try {
      console.log('💾 chapterStore.saveChapter: сохраняю главу', currentChapter.value.id);
      await chapterService.save(project, currentChapter.value);

      hasUnsavedChanges.value = false;
      if (emitFn) emitFn('chapter-saved');
      
      const listIdx = chapters.value.findIndex(c => c.id === currentChapterId.value);
      if (listIdx !== -1) chapters.value[listIdx].title = currentChapter.value.title;
      
      await chapterService.updateIndex(project);
      document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
      console.log('✅ chapterStore.saveChapter: глава сохранена');
      debugError.value = null;
      return true;
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      console.error('❌ saveChapter ошибка:', err);
      debugError.value = `Ошибка сохранения: ${err}`;
      return false;
    } finally {
      isSaving.value = false;
    }
  };

  const openChapter = async (project: string, id: string) => {
    console.log('📖 chapterStore.openChapter: вызван для ID', id);
    if (hasUnsavedChanges.value) {
      console.log('📖 openChapter: есть несохраненные изменения, сохраняю');
      await saveChapter(project);
    }
    try {
      console.log('📖 openChapter: загружаю главу через chapterService.get');
      const full = await chapterService.get(project, id);
      if (!full) {
        console.warn('⚠️ Глава не найдена или удалена:', id);
        return false;
      }
      if (!full.timeline_events) full.timeline_events = [];
      if (!full.participants) full.participants = [];
      if (!full.footnotes) full.footnotes = {};

      currentChapter.value = JSON.parse(JSON.stringify(full));
      currentChapterId.value = id;
      hasUnsavedChanges.value = false;
      console.log('✅ openChapter: глава полностью загружена и готова');
      debugError.value = null;
      return true;
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      console.error('❌ openChapter ошибка:', err, e);
      debugError.value = `Ошибка загрузки главы: ${err}`;
      return false;
    }
  };

  const createNewChapter = async (project: string, arcId?: string, volumeId?: string) => {
    console.error('🔥🔥🔥 chapter.store: createNewChapter called with', { arcId, volumeId });
    const allChapters = hierarchy.value?.chapters ?? [];
    let relevantChapters = allChapters;
    if (arcId || volumeId) {
      relevantChapters = allChapters.filter(c => {
        if (arcId) return c.arc_id === arcId;
        if (volumeId) return c.volume_id === volumeId && !c.arc_id;
        return false;
      });
    }
    let maxNum = 0;
    relevantChapters.forEach(c => {
      const m = (c.title || '').match(/Глава\s*(\d+)/i);
      if (m) {
        const n = parseInt(m[1]);
        if (n > maxNum) maxNum = n;
      }
    });
    const num = maxNum + 1;
    const newCh: ChapterWithHierarchy = chapterService.createNew(`Глава ${num}`);
    if (arcId) newCh.arc_id = arcId;
    if (volumeId) newCh.volume_id = volumeId;

    if (num === 1) {
      try {
        const cal = await useCalendarStore().loadCalendar(project);
        if (cal && cal.точка_отсчета) {
          newCh.timeline_events = [{
            date: {
              era: cal.точка_отсчета.эпоха ?? 0,
              year: cal.точка_отсчета.год ?? 1,
              month: cal.точка_отсчета.месяц ?? 0,
              day: cal.точка_отсчета.день ?? 1
            },
            time: { hour: 12, minute: 0 },
            description: "Начало истории"
          }];
        }
      } catch (e) {
        console.warn("Failed to attach default timeline event", e);
      }
    }

    console.error('🔥🔥🔥 chapter.store: saving new chapter', newCh);
    await chapterService.save(project, newCh);
    console.error('🔥🔥🔥 chapter.store: chapter saved, checking relations...');
    if (arcId || volumeId) {
      console.error('🔥🔥🔥 chapter.store: calling api.assignChapter...', { project, id: newCh.id, arcId, volumeId });
      if (newCh.id) {
        await api.assignChapter(project, newCh.id, arcId ?? null, volumeId ?? null);
      }
      console.error('🔥🔥🔥 chapter.store: api.assignChapter DONE!');
    }
    console.error('🔥🔥🔥 chapter.store: fetching hierarchy...');
    hierarchy.value = (await api.getChapterHierarchy(project).catch(() => hierarchy.value)) as unknown as ChapterHierarchy;
    console.error('🔥🔥🔥 chapter.store: hierarchy loaded!', hierarchy.value);
    if (newCh.id) {
      await openChapter(project, newCh.id);
    }
    return newCh;
  };

  const onRenameChapter = async (project: string, chapter: Chapter | { id?: string | null; title?: string }, newTitle: string) => {
    const updated = { ...chapter, title: newTitle };
    await chapterService.save(project, updated as unknown as Chapter);
    if (currentChapterId.value === chapter.id && currentChapter.value) {
      currentChapter.value.title = newTitle;
    }
  };

  const deleteChapter = async (project: string, id: string) => {
    await chapterService.delete(project, id);
    if (currentChapterId.value === id) {
      currentChapterId.value = undefined;
      currentChapter.value = null;
    }
  };

  return {
    loading, chapters, hierarchy, currentChapterId, currentChapter,
    hasUnsavedChanges, debugError, isSaving,
    currentChapterNode, currentArc, currentVolume,
    loadChapters, loadHierarchy, saveChapter, openChapter, 
    createNewChapter, onRenameChapter, deleteChapter
  };
});

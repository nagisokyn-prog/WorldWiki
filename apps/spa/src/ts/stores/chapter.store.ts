import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { chapterService } from '../services/chapter.service';
import { useTimelineStore } from './timeline.store';
import * as api from '../services/api.client';
import { useCalendarStore } from './calendar.store';
import type { Chapter } from '../types/generated/Chapter';
import type { TimelineEvent } from '@/features/timeline/TimelinePanel/useTimelinePanel';
import type { ParticipantItem } from '@/features/chapters/ParticipantsPanel/useParticipantsPanel';

export type ChapterWithHierarchy = Omit<Chapter, 'timeline_events' | 'participants' | 'footnotes'> & {
  timeline_events?: TimelineEvent[] | null;
  participants?: (ParticipantItem | string)[] | null;
  footnotes?: Record<string, { id: string; text: string }> | null;
  volume_id?: string | null;
  [key: string]: unknown;
};

export interface HierarchyVolume {
  id: string;
  title?: string;
  [key: string]: unknown;
}

export interface ChapterHierarchy {
  volumes: HierarchyVolume[];
  chapters: ChapterWithHierarchy[];
}

export const useChapterStore = defineStore('chapter', () => {
  const loading = ref(false);
  const chapters = ref<ChapterWithHierarchy[]>([]);
  const hierarchy = ref<ChapterHierarchy>({ volumes: [], chapters: [] });
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

  const currentVolume = computed(() => {
    const ch = currentChapterNode.value;
    const volId = ch?.volume_id;
    if (!volId || !hierarchy.value.volumes) return null;
    return hierarchy.value.volumes.find(v => v.id === volId) || null;
  });

  const loadChapters = async (project: string) => {
    try {
      console.log('📚 chapterStore.loadChapters: загружаю иерархию для проекта', project);
      loading.value = true;
      hierarchy.value = (await api.getChapterHierarchy(project)) as unknown as ChapterHierarchy;
      chapters.value = hierarchy.value.chapters || [];
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
    const autoParts = timelineStore.parseParticipants(currentChapter.value.content || '');
    const participantsList = (currentChapter.value.participants || []) as unknown as Array<{ id?: string; type?: string; autoParsed?: boolean; [key: string]: unknown }>;
    autoParts.forEach((p: { id?: string; type?: string; name?: string }) => {
      if (!participantsList.some((ep: { id?: string; type?: string }) => ep.id === p.id && ep.type === p.type)) {
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
      const rawFull = await chapterService.get(project, id);
      if (!rawFull) {
        console.warn('⚠️ Глава не найдена или удалена:', id);
        return false;
      }
      const rawObj = rawFull as Record<string, unknown>;
      const full: ChapterWithHierarchy = {
        ...rawFull,
        timeline_events: Array.isArray(rawObj.timeline_events) ? (rawObj.timeline_events as unknown as TimelineEvent[]) : [],
        participants: Array.isArray(rawObj.participants) ? (rawObj.participants as (string | ParticipantItem)[]) : [],
        footnotes: (rawObj.footnotes as unknown as Record<string, { id: string; text: string }>) || {}
      };

      const timelineStore = useTimelineStore();
      const autoParts = timelineStore.parseParticipants(full.content || '');
      const partsList: (string | ParticipantItem)[] = [...(full.participants || [])];
      autoParts.forEach((p: { id?: string; type?: string; name?: string }) => {
        if (!partsList.some((ep) => {
          if (typeof ep === 'string') return ep === p.id || ep === p.name;
          return (ep.id === p.id && ep.type === p.type) || (ep.name === p.name && ep.type === p.type);
        })) {
          partsList.push({ id: p.id || '', type: p.type || '', name: p.name, autoParsed: true });
        }
      });
      full.participants = partsList;

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

  const createNewChapter = async (project: string, volumeId?: string) => {
    console.error('🔥🔥🔥 chapter.store: createNewChapter called with', { volumeId });
    const allChapters = hierarchy.value?.chapters ?? [];
    const relevantChapters = volumeId
      ? allChapters.filter(c => c.volume_id === volumeId)
      : allChapters.filter(c => !c.volume_id);
    let maxNum = 0;
    relevantChapters.forEach(c => {
      const m = (c.title || '').match(/Глава\s*(\d+)/i);
      if (m) {
        const n = parseInt(m[1]);
        if (n > maxNum) maxNum = n;
      }
    });
    const num = maxNum + 1;
    const newCh: ChapterWithHierarchy = {
      ...chapterService.createNew(`Глава ${num}`),
      timeline_events: [],
      participants: [],
      footnotes: {}
    };
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
    if (volumeId) {
      console.error('🔥🔥🔥 chapter.store: calling api.assignChapter...', { project, id: newCh.id, volumeId });
      if (newCh.id) {
        await api.assignChapter(project, newCh.id, volumeId);
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
    currentChapterNode, currentVolume,
    loadChapters, loadHierarchy, saveChapter, openChapter, 
    createNewChapter, onRenameChapter, deleteChapter
  };
});

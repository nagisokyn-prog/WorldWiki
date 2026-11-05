import { defineStore } from 'pinia';
import { ref, toRaw } from 'vue';
import { calendarApi } from '@/services/api/calendar.api';

export interface TimelineEvent {
  [key: string]: unknown;
}

export interface Participant {
  type: string;
  id: string;
  name: string;
}

export interface ChapterTimeline {
  chapter_id: string;
  chapter_title: string;
  events?: TimelineEvent[];
  participants?: Participant[];
}

export const useTimelineStore = defineStore('timeline', () => {
  const currentProject = ref<string | null>(null);
  const timelines = ref<ChapterTimeline[]>([]);

  async function init(project: string | null) {
    // Allow re-initialization with null to clear timelines
    if (project !== null && currentProject.value === project) return;
    currentProject.value = project;
    await loadTimelines();
  }

  async function loadTimelines() {
    if (!currentProject.value) {
      timelines.value = [];
      return;
    }
    try {
      const data = await calendarApi.getGlobalTimeline(currentProject.value);
      timelines.value = Array.isArray(data) ? data : [];
      console.log(`✅ Загружено таймлайнов глав из БД: ${timelines.value.length}`);
    } catch (error) {
      console.error('Ошибка загрузки таймлайна из БД:', error);
      timelines.value = [];
    }
  }

  function getTimelineForChapter(chapterId: string): ChapterTimeline | null {
    return timelines.value.find(t => t.chapter_id === chapterId) || null;
  }

  function getEventsForChapter(chapterId: string): TimelineEvent[] {
    const timeline = getTimelineForChapter(chapterId);
    return timeline?.events ? structuredClone(toRaw(timeline.events)) : [];
  }

  function getParticipantsForChapter(chapterId: string): Participant[] {
    const timeline = getTimelineForChapter(chapterId);
    return timeline?.participants ? structuredClone(toRaw(timeline.participants)) : [];
  }

  function clearChapterTimeline(chapterId: string): boolean {
    const index = timelines.value.findIndex(t => t.chapter_id === chapterId);
    if (index !== -1) {
      timelines.value.splice(index, 1);
    }
    return true;
  }

  function getAllEvents(): Array<TimelineEvent & { chapter_id?: string; chapter_title?: string }> {
    const allEvents: Array<TimelineEvent & { chapter_id?: string; chapter_title?: string }> = [];
    timelines.value.forEach(timeline => {
      if (timeline.events) {
        timeline.events.forEach(event => {
          allEvents.push({
            ...structuredClone(toRaw(event)),
            chapter_id: timeline.chapter_id,
            chapter_title: timeline.chapter_title
          });
        });
      }
    });
    return allEvents;
  }

  function safeDecode(val: string): string {
    try {
      return decodeURIComponent(val);
    } catch (err) {
      console.warn('[timeline.store] URI decode failed, using raw string:', err);
      return val;
    }
  }

  function parseParticipants(text: string): Participant[] {
    if (!text) return [];

    const participants: Participant[] = [];
    
    // Legacy format: [name](...type=type&id=id...)
    const legacyRegex = /\[([^\]]*)\]\([^)]+type=([^&]+)&id=([^&]+?)\.\.\./g;
    let match: RegExpExecArray | null;
    let limit = 5000;
    while ((match = legacyRegex.exec(text)) !== null && limit-- > 0) {
      if (match.index === legacyRegex.lastIndex) legacyRegex.lastIndex++;
      const rawName = match[1]?.trim() || '';
      let type = match[2]?.trim() || 'entity';
      let id = match[3]?.trim() || rawName;

      type = safeDecode(type);
      id = safeDecode(id);

      if (!id && !rawName) continue;
      if (!id) id = rawName;

      if (!participants.some(p => p.id === id && p.type === type)) {
        participants.push({ type, id, name: rawName });
      }
    }

    // Конструкция ((...))[...]: извлекаем имя из (()) и метаданные сущности из [...]
    const newRegex = /\(\((.*?)\)\)\[(.*?)\]/g;
    limit = 5000;
    while ((match = newRegex.exec(text)) !== null && limit-- > 0) {
      if (match.index === newRegex.lastIndex) newRegex.lastIndex++;
      const rawName = match[1]?.trim() || '';
      const inner = match[2]?.trim() || '';
      let type = 'entity';
      let id = '';

      // 1. Проверяем URL параметры (type=...&id=...)
      const typeUrlMatch = inner.match(/type=([^&]+)/);
      const idUrlMatch = inner.match(/id=([^&]+)/);
      if (idUrlMatch) {
        id = idUrlMatch[1];
        if (typeUrlMatch) {
          type = typeUrlMatch[1];
        }
      } else if (inner.includes(':')) {
        // 2. Формат type:id или entities:uuid
        const parts = inner.split(':');
        type = parts[0]?.trim() || 'entity';
        id = inner.trim();
      } else if (inner.length > 0) {
        // 3. Просто id
        id = inner;
      }

      if (!id && !rawName) continue;
      if (!id) id = rawName;

      type = safeDecode(type);
      id = safeDecode(id);

      const rawId = id.includes(':') ? id.split(':').slice(1).join(':') : id;

      if (!participants.some(p => {
        const pRawId = p.id.includes(':') ? p.id.split(':').slice(1).join(':') : p.id;
        return (p.id === id || (rawId && pRawId === rawId)) || (rawName && p.name === rawName);
      })) {
        participants.push({ type, id, name: rawName });
      }
    }

    // HTML link format: <a href="...type=type&id=id...">name</a> or <a href="entity://type/id">name</a>
    const htmlRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    limit = 5000;
    while ((match = htmlRegex.exec(text)) !== null && limit-- > 0) {
      if (match.index === htmlRegex.lastIndex) htmlRegex.lastIndex++;
      const href = match[1];
      const rawName = match[2]?.replace(/<[^>]+>/g, '').trim() || '';

      let type = 'entity';
      let id = '';

      const typeMatch = href.match(/type=([^&"']+)/);
      const idMatch = href.match(/id=([^&"']+)/);
      if (idMatch) {
        id = idMatch[1];
        if (typeMatch) {
          type = typeMatch[1];
        }
      } else if (href.startsWith('entity://')) {
        const parts = href.replace('entity://', '').split('/');
        type = parts[0] || 'entity';
        id = parts.slice(1).join('/') || rawName;
      }

      if (!id && !rawName) continue;
      if (!id) id = rawName;

      type = safeDecode(type);
      id = safeDecode(id);

      const rawId = id.includes(':') ? id.split(':').slice(1).join(':') : id;

      if (!participants.some(p => {
        const pRawId = p.id.includes(':') ? p.id.split(':').slice(1).join(':') : p.id;
        return (p.id === id || (rawId && pRawId === rawId)) || (rawName && p.name === rawName);
      })) {
        participants.push({ type, id, name: rawName });
      }
    }

    return participants;
  }

  return {
    currentProject,
    timelines,
    init,
    loadTimelines,
    getTimelineForChapter,
    getEventsForChapter,
    getParticipantsForChapter,
    clearChapterTimeline,
    getAllEvents,
    parseParticipants
  };
});

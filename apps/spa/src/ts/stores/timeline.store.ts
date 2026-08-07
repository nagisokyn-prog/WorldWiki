import { defineStore } from 'pinia';
import { ref } from 'vue';
import { calendarApi } from '../services/api/calendar.api';

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

  async function init(project: string) {
    if (currentProject.value === project) return;
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
    return timeline?.events ? structuredClone(timeline.events) : [];
  }

  function getParticipantsForChapter(chapterId: string): Participant[] {
    const timeline = getTimelineForChapter(chapterId);
    return timeline?.participants ? structuredClone(timeline.participants) : [];
  }

  async function clearChapterTimeline(chapterId: string): Promise<boolean> {
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
            ...structuredClone(event),
            chapter_id: timeline.chapter_id,
            chapter_title: timeline.chapter_title
          });
        });
      }
    });
    return allEvents;
  }

  function parseParticipants(text: string): Participant[] {
    if (!text) return [];

    const participants: Participant[] = [];
    
    // Legacy format: [name](...type=type&id=id...)
    const legacyRegex = /\[([^\]]+)\]\([^)]+type=([^&]+)&id=([^&)]+)[^)]*\)/g;
    let match;
    while ((match = legacyRegex.exec(text)) !== null) {
      const name = match[1];
      const type = match[2];
      const id = match[3];

      if (!participants.some(p => p.type === type && p.id === id)) {
        participants.push({ type, id, name });
      }
    }

    // New format: ((name))[type:id]
    const newRegex = /\(\((.*?)\)\)\[([^:\]]+):([^\]]+)\]/g;
    while ((match = newRegex.exec(text)) !== null) {
      const name = match[1];
      const type = match[2];
      const id = match[3];

      if (!participants.some(p => p.type === type && p.id === id)) {
        participants.push({ type, id, name });
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

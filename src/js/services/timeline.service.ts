/**
 * @file timeline.service.ts
 * @description Сервис для работы с таймлайном проекта (события по главам)
 */

import { apiService } from './api.service';

interface TimelineEvent {
  [key: string]: unknown;
}

interface Participant {
  type: string;
  id: string;
  name: string;
}

interface ChapterTimeline {
  chapter_id: string;
  chapter_title: string;
  events?: TimelineEvent[];
  participants?: Participant[];
}

class TimelineService {
  currentProject: string | null = null;
  timelines: ChapterTimeline[] = [];

  async init(project: string): Promise<void> {
    if (this.currentProject === project) return;
    this.currentProject = project;
    await this.loadTimelines();
  }

  async loadTimelines(): Promise<void> {
    if (!this.currentProject) {
      this.timelines = [];
      return;
    }
    try {
      // Теперь тянем из БД через новый Rust-обработчик
      const data = await apiService.getGlobalTimeline(this.currentProject);
      this.timelines = Array.isArray(data) ? data : [];
      console.log(`✅ Загружено таймлайнов глав из БД: ${this.timelines.length}`);
    } catch (error) {
      console.error('Ошибка загрузки таймлайна из БД:', error);
      this.timelines = [];
    }
  }

  getTimelineForChapter(chapterId: string): ChapterTimeline | null {
    return this.timelines.find(t => t.chapter_id === chapterId) || null;
  }

  getEventsForChapter(chapterId: string): TimelineEvent[] {
    const timeline = this.getTimelineForChapter(chapterId);
    return timeline?.events || [];
  }

  getParticipantsForChapter(chapterId: string): Participant[] {
    const timeline = this.getTimelineForChapter(chapterId);
    return timeline?.participants || [];
  }

  async clearChapterTimeline(chapterId: string): Promise<boolean> {
    const index = this.timelines.findIndex(t => t.chapter_id === chapterId);
    if (index !== -1) {
      this.timelines.splice(index, 1);
    }
    return true;
  }

  getAllEvents(): Array<TimelineEvent & { chapter_id?: string; chapter_title?: string }> {
    const allEvents: Array<TimelineEvent & { chapter_id?: string; chapter_title?: string }> = [];
    this.timelines.forEach(timeline => {
      if (timeline.events) {
        timeline.events.forEach(event => {
          allEvents.push({
            ...event,
            chapter_id: timeline.chapter_id,
            chapter_title: timeline.chapter_title
          });
        });
      }
    });
    return allEvents;
  }

  parseParticipants(text: string): Participant[] {
    if (!text) return [];

    const linkRegex = /\[([^\]]+)\]\([^)]+type=([^&]+)&id=([^&)]+)[^)]*\)/g;
    let match;
    const participants: Participant[] = [];

    while ((match = linkRegex.exec(text)) !== null) {
      const name = match[1];
      const type = match[2];
      const id = match[3];

      if (!participants.some(p => p.type === type && p.id === id)) {
        participants.push({ type, id, name });
      }
    }

    return participants;
  }
}

export const timelineService = new TimelineService();
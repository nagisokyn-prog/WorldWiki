import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTimelineStore } from '../timeline.store';

vi.mock('../../services/api/calendar.api', () => ({
  calendarApi: {
    getGlobalTimeline: vi.fn(),
  },
}));

import { calendarApi } from '../../services/api/calendar.api';

describe('useTimelineStore', () => {
  let store: ReturnType<typeof useTimelineStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useTimelineStore();
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('sets currentProject and loads timelines', async () => {
      const mockTimelines = [
        { chapter_id: 'ch1', chapter_title: 'Chapter 1', events: [], participants: [] },
      ];
      (calendarApi.getGlobalTimeline as any).mockResolvedValue(mockTimelines);

      await store.init('project-1');

      expect(store.currentProject).toBe('project-1');
      expect(calendarApi.getGlobalTimeline).toHaveBeenCalledWith('project-1');
      expect(store.timelines).toEqual(mockTimelines);
    });

    it('does not reload if same project', async () => {
      (calendarApi.getGlobalTimeline as any).mockResolvedValue([]);
      
      await store.init('project-1');
      await store.init('project-1');

      expect(calendarApi.getGlobalTimeline).toHaveBeenCalledTimes(1);
    });

    it('clears timelines when project is null', async () => {
      store.timelines = [{ chapter_id: 'ch1', chapter_title: 'Ch1', events: [], participants: [] }];
      
      await store.init(null as any);

      expect(store.timelines).toEqual([]);
      expect(store.currentProject).toBeNull();
    });
  });

  describe('loadTimelines', () => {
    it('loads timelines from API', async () => {
      store.currentProject = 'project-1';
      const mockData = [
        { chapter_id: 'ch1', chapter_title: 'Chapter 1', events: [{ id: 'e1' }], participants: [] },
      ];
      (calendarApi.getGlobalTimeline as any).mockResolvedValue(mockData);

      await store.loadTimelines();

      expect(store.timelines).toEqual(mockData);
    });

    it('handles API error gracefully', async () => {
      store.currentProject = 'project-1';
      (calendarApi.getGlobalTimeline as any).mockRejectedValue(new Error('Network error'));

      await store.loadTimelines();

      expect(store.timelines).toEqual([]);
    });

    it('handles non-array response', async () => {
      store.currentProject = 'project-1';
      (calendarApi.getGlobalTimeline as any).mockResolvedValue(null);

      await store.loadTimelines();

      expect(store.timelines).toEqual([]);
    });

    it('does nothing when no current project', async () => {
      store.currentProject = null;
      store.timelines = [{ chapter_id: 'ch1', chapter_title: 'Ch1', events: [], participants: [] }];

      await store.loadTimelines();

      expect(store.timelines).toEqual([]);
      expect(calendarApi.getGlobalTimeline).not.toHaveBeenCalled();
    });
  });

  describe('getTimelineForChapter', () => {
    it('returns timeline for existing chapter', () => {
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Ch1', events: [], participants: [] },
        { chapter_id: 'ch2', chapter_title: 'Ch2', events: [], participants: [] },
      ];

      const result = store.getTimelineForChapter('ch1');

      expect(result).toEqual(store.timelines[0]);
    });

    it('returns null for non-existent chapter', () => {
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Ch1', events: [], participants: [] },
      ];

      const result = store.getTimelineForChapter('ch999');

      expect(result).toBeNull();
    });

    it('returns null for empty timelines', () => {
      store.timelines = [];

      const result = store.getTimelineForChapter('ch1');

      expect(result).toBeNull();
    });
  });

  describe('getEventsForChapter', () => {
    it('returns cloned events for chapter', () => {
      const events = [{ id: 'e1', date: '2024-01-01' }, { id: 'e2', date: '2024-01-02' }];
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Ch1', events, participants: [] },
      ];

      const result = store.getEventsForChapter('ch1');

      expect(result).toEqual(events);
      expect(result).not.toBe(events);
    });

    it('returns empty array for non-existent chapter', () => {
      store.timelines = [];

      const result = store.getEventsForChapter('ch1');

      expect(result).toEqual([]);
    });

    it('returns empty array when chapter has no events', () => {
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Ch1', events: undefined, participants: [] },
      ];

      const result = store.getEventsForChapter('ch1');

      expect(result).toEqual([]);
    });

    it('returns empty array when chapter has empty events', () => {
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Ch1', events: [], participants: [] },
      ];

      const result = store.getEventsForChapter('ch1');

      expect(result).toEqual([]);
    });
  });

  describe('getParticipantsForChapter', () => {
    it('returns cloned participants for chapter', () => {
      const participants = [{ type: 'character', id: 'c1', name: 'Hero' }];
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Ch1', events: [], participants },
      ];

      const result = store.getParticipantsForChapter('ch1');

      expect(result).toEqual(participants);
      expect(result).not.toBe(participants);
    });

    it('returns empty array for non-existent chapter', () => {
      const result = store.getParticipantsForChapter('ch1');
      expect(result).toEqual([]);
    });

    it('returns empty array when chapter has no participants', () => {
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Ch1', events: [], participants: undefined },
      ];

      const result = store.getParticipantsForChapter('ch1');

      expect(result).toEqual([]);
    });
  });

  describe('clearChapterTimeline', () => {
    it('removes timeline for chapter', () => {
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Ch1', events: [], participants: [] },
        { chapter_id: 'ch2', chapter_title: 'Ch2', events: [], participants: [] },
      ];

      const result = store.clearChapterTimeline('ch1');

      expect(result).toBe(true);
      expect(store.timelines).toHaveLength(1);
      expect(store.timelines[0].chapter_id).toBe('ch2');
    });

    it('returns true even for non-existent chapter', () => {
      store.timelines = [];

      const result = store.clearChapterTimeline('ch1');

      expect(result).toBe(true);
    });

    it('removes correct chapter when multiple exist', () => {
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Ch1', events: [], participants: [] },
        { chapter_id: 'ch2', chapter_title: 'Ch2', events: [], participants: [] },
        { chapter_id: 'ch3', chapter_title: 'Ch3', events: [], participants: [] },
      ];

      store.clearChapterTimeline('ch2');

      expect(store.timelines).toHaveLength(2);
      expect(store.timelines.map(t => t.chapter_id)).toEqual(['ch1', 'ch3']);
    });
  });

  describe('getAllEvents', () => {
    it('returns all events with chapter info', () => {
      store.timelines = [
        { 
          chapter_id: 'ch1', 
          chapter_title: 'Chapter 1', 
          events: [{ id: 'e1' }, { id: 'e2' }], 
          participants: [] 
        },
        { 
          chapter_id: 'ch2', 
          chapter_title: 'Chapter 2', 
          events: [{ id: 'e3' }], 
          participants: [] 
        },
      ];

      const result = store.getAllEvents();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: 'e1', chapter_id: 'ch1', chapter_title: 'Chapter 1' });
      expect(result[1]).toEqual({ id: 'e2', chapter_id: 'ch1', chapter_title: 'Chapter 1' });
      expect(result[2]).toEqual({ id: 'e3', chapter_id: 'ch2', chapter_title: 'Chapter 2' });
    });

    it('returns empty array when no timelines', () => {
      store.timelines = [];
      expect(store.getAllEvents()).toEqual([]);
    });

    it('skips timelines without events', () => {
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Ch1', events: [], participants: [] },
        { chapter_id: 'ch2', chapter_title: 'Ch2', events: undefined, participants: [] },
        { chapter_id: 'ch3', chapter_title: 'Ch3', events: [{ id: 'e1' }], participants: [] },
      ];

      const result = store.getAllEvents();

      expect(result).toHaveLength(1);
      expect(result[0].chapter_id).toBe('ch3');
    });

    it('returns cloned events', () => {
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Ch1', events: [{ id: 'e1' }], participants: [] },
      ];

      const result = store.getAllEvents();
      result[0].id = 'modified';

      expect(store.timelines[0].events?.[0]?.id).toBe('e1');
    });

    it('includes chapter_id and chapter_title in each event', () => {
      store.timelines = [
        { chapter_id: 'ch1', chapter_title: 'Chapter One', events: [{ id: 'e1', custom: 'data' }], participants: [] },
      ];

      const result = store.getAllEvents();

      expect(result[0]).toHaveProperty('chapter_id', 'ch1');
      expect(result[0]).toHaveProperty('chapter_title', 'Chapter One');
      expect(result[0]).toHaveProperty('custom', 'data');
    });
  });

  describe('parseParticipants', () => {
    it('parses legacy format [name](...type=type&id=id...)', () => {
      const text = 'Hello [John](...type=character&id=char1...) and [Jane](...type=character&id=char2...)';
      
      const result = store.parseParticipants(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'character', id: 'char1', name: 'John' });
      expect(result[1]).toEqual({ type: 'character', id: 'char2', name: 'Jane' });
    });

    it('parses new format ((name))[type:id]', () => {
      const text = 'Meet ((Hero))[character:char1] and ((Villain))[character:char2]';
      
      const result = store.parseParticipants(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'character', id: 'char1', name: 'Hero' });
      expect(result[1]).toEqual({ type: 'character', id: 'char2', name: 'Villain' });
    });

    it('handles mixed formats', () => {
      const text = 'Old [John](...type=character&id=1...) and new ((Jane))[character:2]';
      
      const result = store.parseParticipants(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: 'character', id: '1', name: 'John' });
      expect(result[1]).toEqual({ type: 'character', id: '2', name: 'Jane' });
    });

    it('deduplicates participants by type and id', () => {
      const text = '((Hero))[character:1] and again ((Hero))[character:1]';
      
      const result = store.parseParticipants(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'character', id: '1', name: 'Hero' });
    });

    it('returns empty array for empty text', () => {
      expect(store.parseParticipants('')).toEqual([]);
      expect(store.parseParticipants('   ')).toEqual([]);
    });

    it('returns empty array for text without markers', () => {
      const text = 'Just plain text without any participant markers.';
      
      const result = store.parseParticipants(text);

      expect(result).toEqual([]);
    });

    it('handles special characters in names', () => {
      const text = 'Meet ((John "The Brave"))[character:1]';
      
      const result = store.parseParticipants(text);

      expect(result[0].name).toBe('John "The Brave"');
    });

    it('handles multiple types', () => {
      const text = '((Hero))[character:1] and ((Sword))[item:2] in ((Castle))[location:3]';
      
      const result = store.parseParticipants(text);

      expect(result).toHaveLength(3);
      expect(result.map(p => p.type)).toEqual(['character', 'item', 'location']);
    });

    it('handles legacy format with special chars in type/id', () => {
      const text = 'Test [Name](...type=my_type&id=my-id-123...)';
      
      const result = store.parseParticipants(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'my_type', id: 'my-id-123', name: 'Name' });
    });

    it('ignores malformed legacy format', () => {
      const text = '[Name](...type=character...) and [Name2](...id=123...)';
      
      const result = store.parseParticipants(text);

      expect(result).toHaveLength(0);
    });

    it('ignores malformed new format', () => {
      const text = '((Name))[character] and ((Name2))[type:]';
      
      const result = store.parseParticipants(text);

      expect(result).toHaveLength(0);
    });
  });
});
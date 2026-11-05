import { describe, it, expect } from 'vitest';
import {
  normalizeId,
  checkIsFlashback,
  cleanParticipantsList,
  calculateConnectionLines
} from '../timelineInspector.utils';
import type { InspectorEvent, InspectorChapter } from '../TimelineInspector.model';

describe('timelineInspector.utils', () => {
  it('normalizes id table prefixes', () => {
    expect(normalizeId('chapters:ch_123')).toBe('ch_123');
    expect(normalizeId('entities:char_1')).toBe('char_1');
    expect(normalizeId('plain_id')).toBe('plain_id');
    expect(normalizeId(null)).toBe('');
  });

  it('detects flashback from text or kind', () => {
    const ev1: InspectorEvent = {
      id: 'timeline_events:1',
      title: 'Сцена флешбэка в детстве',
      m_abs: 100,
      reveals: [],
      participants: []
    };
    const chapters: InspectorChapter[] = [];
    expect(checkIsFlashback(ev1, chapters)).toBe(true);
  });

  it('cleans participants list properly', () => {
    const list = cleanParticipantsList([
      'entities:hero',
      { id: 'entities:villain', name: 'Villain', entity_type: 'character' },
      { id: '', name: '  ' }
    ]);
    expect(list.length).toBe(2);
    expect(list[0].name).toBe('hero');
    expect(list[1].name).toBe('Villain');
  });

  it('calculates connection lines', () => {
    const ch: InspectorChapter = {
      id: 'chapters:c1',
      title: 'Chapter 1',
      sort_order: 1
    };
    const ev: InspectorEvent = {
      id: 'timeline_events:e1',
      title: 'Event 1',
      m_abs: 1000,
      reveals: [
        {
          chapter_id: 'chapters:c1',
          chapter_title: 'Chapter 1',
          kind: 'direct'
        }
      ],
      participants: []
    };

    const lines = calculateConnectionLines({
      linkMode: 'all',
      chapters: [ch],
      events: [ev],
      activeChapterId: null,
      hoveredChapterId: null,
      hoveredEventId: null
    });

    expect(lines.length).toBe(1);
    expect(lines[0].chapterId).toBe('chapters:c1');
    expect(lines[0].eventId).toBe('timeline_events:e1');
  });
});


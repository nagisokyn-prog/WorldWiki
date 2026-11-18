import { describe, it, expect } from 'vitest';
import {
  normalizeId,
  checkIsFlashback,
  cleanParticipantsList,
  calculateConnectionLines,
  resolveBestEraIndex,
  formatEventDate,
  buildFilteredChapters,
  filterInspectorEvents,
  buildFormattedEvents,
} from '../timelineInspector.utils';
import type { InspectorEvent, InspectorChapter } from '../TimelineInspector.model';
import type { CalendarData } from '@/services/Calendars/calendar.types';

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

  it('normalizes SurrealDB object ids and detects chronological flashbacks', () => {
    expect(normalizeId({ id: { String: '⟨ch_9⟩' } })).toBe('ch_9');

    const chs: InspectorChapter[] = [
      { id: 'c1', title: 'Ch1', sort_order: 1 },
      { id: 'c2', title: 'Ch2', sort_order: 2 },
    ];
    const evPrev: InspectorEvent = {
      id: 'timeline_events:1',
      title: 'Present',
      m_abs: 10000,
      reveals: [{ chapter_id: 'c1', chapter_title: 'Ch1', kind: 'direct' }],
      participants: [],
    };
    const evFlash: InspectorEvent = {
      id: 'timeline_events:2',
      title: 'Past',
      m_abs: 1000,
      reveals: [{ chapter_id: 'c2', chapter_title: 'Ch2', kind: 'direct' }],
      participants: [],
    };

    expect(checkIsFlashback(evFlash, chs, [evPrev, evFlash])).toBe(true);
    expect(checkIsFlashback(evPrev, chs, [evPrev, evFlash])).toBe(false);
  });

  it('resolves era index, formats dates, filters chapters and events, and builds formatted events', () => {
    const cal = {
      id: 'cal_1',
      название: 'Std',
      минут_в_часе: 60,
      часов_в_сутках: 24,
      месяцы: [{ название: 'Янв', дней: 30 }],
      эпохи: [
        { название: 'До н.э.', обратный_отсчет: true, год_начала: 1, год_конца: 1000 },
        { название: 'Н.э.', обратный_отсчет: false, год_начала: 1, год_конца: 5000 },
      ],
    } as unknown as CalendarData;

    expect(resolveBestEraIndex(1440, cal)).toBe(1);
    expect(resolveBestEraIndex(-1440, cal)).toBe(0);
    expect(formatEventDate(1440, null)).toBe('M_abs: 1440');
    expect(typeof formatEventDate(1440, cal)).toBe('string');

    const chs: InspectorChapter[] = [
      { id: 'c1', title: ' ', sort_order: 1 },
      { id: 'c2', title: 'Вторая', sort_order: 2 },
    ];
    const evs: InspectorEvent[] = [
      {
        id: 'plot_promises:p1',
        title: 'Сцена у ворот',
        description: 'Описание',
        m_abs: 2000,
        kind: 'scene',
        reveals: [{ chapter_id: 'c1', chapter_title: 'Глава #1', kind: 'flashback', pov_id: 'pov1' }],
        participants: [{ id: 'entities:e1', name: 'Герой' }],
      },
      {
        id: 'timeline_events:dup',
        title: 'Сцена у ворот',
        m_abs: 2000,
        kind: 'event',
        reveals: [{ chapter_id: 'c1', chapter_title: 'Глава #1', kind: 'direct', pov_id: 'pov1' }],
        participants: ['entities:e1'],
      },
      {
        id: 'timeline_events:ev2',
        title: 'Обычное событие',
        m_abs: 3000,
        kind: 'event',
        calendar_id: 'cal_1',
        location_id: 'entities:loc1',
        reveals: [{ chapter_id: 'c2', chapter_title: 'Вторая', kind: 'direct', pov_id: 'pov2' }],
        participants: [],
      },
    ];

    const filteredChs = buildFilteredChapters(chs, evs, 1);
    expect(filteredChs).toHaveLength(1);
    expect(filteredChs[0].title).toBe('Глава #1');
    expect(filteredChs[0].flashbackCount).toBe(1);

    const filteredEvs = filterInspectorEvents(evs, filteredChs, {
      searchQuery: 'ворот',
      isolatedChapterId: 'c1',
      selectedEntityId: 'entities:e1',
      selectedPovId: 'pov1',
      showFlashbacksOnly: true,
      selectedVolumeId: 'v1',
    });
    expect(filteredEvs).toHaveLength(1);
    expect(filteredEvs[0].id).toBe('plot_promises:p1');

    const calMap = new Map<string, CalendarData>([['cal_1', cal]]);
    const formatted = buildFormattedEvents(evs, chs, cal, evs, [], calMap);
    expect(formatted).toHaveLength(3);
    expect(formatted[2].locationName).toBe('loc1');
  });

  it('covers empty era list, empty filters, pov/entity mismatch, and missing calMap entries', () => {
    expect(resolveBestEraIndex(0, { эпохи: [] } as any)).toBe(0);

    const chs: InspectorChapter[] = [{ id: 'c1', title: 'Глава 1', sort_order: 1 }];
    const evs: InspectorEvent[] = [
      {
        id: 'ev_1',
        title: 'Событие 1',
        description: 'Секрет в описании',
        m_abs: 100,
        kind: 'event',
        calendar_id: 'cal_missing',
        location_id: 'raw_loc',
        reveals: [{ chapter_id: 'c1', chapter_title: 'Глава 1', kind: 'direct', pov_id: 'pov1' }],
        participants: [{ id: 'entities:e1', name: 'Герой' }],
      },
    ];

    expect(buildFilteredChapters(chs, [], 0)).toHaveLength(0);
    expect(buildFilteredChapters(chs, [], null)).toHaveLength(1);
    expect(
      filterInspectorEvents(evs, chs, {
        searchQuery: 'секрет',
        isolatedChapterId: null,
        selectedEntityId: 'all',
        selectedPovId: 'all',
        showFlashbacksOnly: false,
        selectedVolumeId: 'all',
      })
    ).toHaveLength(1);
    expect(
      filterInspectorEvents(evs, chs, {
        searchQuery: 'нет_совпадений',
        isolatedChapterId: null,
        selectedEntityId: 'all',
        selectedPovId: 'all',
        showFlashbacksOnly: false,
        selectedVolumeId: 'all',
      })
    ).toHaveLength(0);

    const formatted = buildFormattedEvents(evs, chs, null, evs, [], new Map());
    expect(formatted[0].locationName).toBe('raw_loc');

    // Additional edge cases: RecordId objects, flashback flags, entity/pov/volume mismatches, officialCalendarId
    const evFlashback: InspectorEvent = {
      id: 'timeline_events:fb_1',
      title: 'Флэшбек',
      m_abs: 50,
      time_nature: 'flashback',
      location_id: 'entities:loc_official',
      reveals: [{ chapter_id: { id: 'chapters:c2' } as any, chapter_title: '', kind: 'direct', pov_id: 'pov_x' }],
      participants: [{ id: 'entities:p1', name: 'P1' }],
    } as any;
    const locOfficial = {
      id: 'entities:loc_official',
      name: 'Цитадель',
      официальный_календарь: 'cal_official',
      широта: 10,
      долгота: 90,
    } as any;
    const officialCal = {
      id: 'cal_official',
      название: 'Официальный',
      эпохи: [{ название: 'Э1', год_начала: undefined, год_конца: undefined }],
      месяцы: [{ название: 'М1', дней: 30 }],
    } as any;

    expect(resolveBestEraIndex(0, officialCal)).toBe(0);
    expect(
      filterInspectorEvents([evFlashback], [{ id: 'c1', volume_id: 'v1', sort_order: 1 }], {
        searchQuery: '',
        isolatedChapterId: 'c1',
        selectedEntityId: 'all',
        selectedPovId: 'all',
        showFlashbacksOnly: false,
        selectedVolumeId: 'all',
      })
    ).toHaveLength(0);
    expect(
      filterInspectorEvents([evFlashback], [{ id: 'c1', volume_id: 'v1', sort_order: 1 }], {
        searchQuery: '',
        isolatedChapterId: null,
        selectedEntityId: 'missing_ent',
        selectedPovId: 'all',
        showFlashbacksOnly: false,
        selectedVolumeId: 'all',
      })
    ).toHaveLength(0);
    expect(
      filterInspectorEvents([evFlashback], [{ id: 'c1', volume_id: 'v1', sort_order: 1 }], {
        searchQuery: '',
        isolatedChapterId: null,
        selectedEntityId: 'all',
        selectedPovId: 'missing_pov',
        showFlashbacksOnly: false,
        selectedVolumeId: 'all',
      })
    ).toHaveLength(0);
    expect(
      filterInspectorEvents([evFlashback], [{ id: 'c1', volume_id: 'v1', sort_order: 1 }], {
        searchQuery: '',
        isolatedChapterId: null,
        selectedEntityId: 'all',
        selectedPovId: 'all',
        showFlashbacksOnly: false,
        selectedVolumeId: 'v1',
      })
    ).toHaveLength(0);

    const formattedOfficial = buildFormattedEvents(
      [evFlashback],
      [{ id: 'chapters:c2', title: 'Вторая', sort_order: 2 }],
      officialCal,
      [evFlashback],
      [locOfficial],
      new Map([['cal_official', officialCal]])
    );
    expect(formattedOfficial[0].locationName).toBe('Цитадель');
  });
});


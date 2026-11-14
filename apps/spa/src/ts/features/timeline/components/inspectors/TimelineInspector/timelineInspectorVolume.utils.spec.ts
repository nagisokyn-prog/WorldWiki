import { describe, it, expect } from 'vitest';
import {
  buildVolumeOptions,
  resolveChaptersWithVolumes,
  buildVolumeSegments,
  calculateConnectionLines,
  calculateSceneHierarchyLines,
} from './timelineInspectorVolume.utils';
import type { InspectorChapter, InspectorEvent } from './TimelineInspector.model';

describe('timelineInspectorVolume.utils', () => {
  describe('buildVolumeOptions', () => {
    it('builds options from volumes and deduplicates chapters volume_ids', () => {
      const opts = buildVolumeOptions(
        [
          { id: 'volume:v1', title: 'Том I' },
          { id: 'v2', title: '' },
          { id: 'v1', title: 'Дубль' },
        ],
        [
          { id: 'c1', volume_id: 'volume:v1' },
          { id: 'c2', volume_id: 'volume:v3' },
          { id: 'c3', volume_id: '' },
        ]
      );

      expect(opts).toEqual([
        { id: 'all', title: 'Все тома' },
        { id: 'v1', title: 'Том I' },
        { id: 'v2', title: 'Том v2' },
        { id: 'v3', title: 'Том v3' },
      ]);
    });

    it('returns only "all" when inputs are omitted', () => {
      expect(buildVolumeOptions()).toEqual([{ id: 'all', title: 'Все тома' }]);
    });
  });

  describe('resolveChaptersWithVolumes', () => {
    const volumes = [
      { id: 'volume:v1', title: 'Первый том' },
      { id: 'volume:v2', title: 'Второй том' },
    ];
    const hierarchy = [
      { id: 'chapter:c1', volume_id: 'volume:v2' },
      { id: 'chapter:c2', volume_id: 'volume:v1' },
    ];
    const chapters: InspectorChapter[] = [
      { id: 'c1', title: 'Ch1', sort_order: 2 },
      { id: 'c2', title: 'Ch2', sort_order: 1 },
      { id: 'c3', title: 'Ch3', volume_id: 'v3', sort_order: 3 },
      { id: 'c4', title: 'Ch4', sort_order: 0 },
    ];

    it('resolves volume_id and volume_title, and sorts by volume order then sort_order', () => {
      const resolved = resolveChaptersWithVolumes(chapters, hierarchy, volumes);
      expect(resolved.map((c) => c.id)).toEqual(['c4', 'c2', 'c3', 'c1']);
      expect(resolved.find((c) => c.id === 'c1')?.volume_title).toBe('Второй том');
      expect(resolved.find((c) => c.id === 'c3')?.volume_title).toBe('Том v3');
      expect(resolved.find((c) => c.id === 'c4')?.volume_title).toBe('Основной том');
    });

    it('filters by selectedVolumeId when not "all"', () => {
      const filtered = resolveChaptersWithVolumes(chapters, hierarchy, volumes, 'volume:v2');
      expect(filtered.map((c) => c.id)).toEqual(['c1']);
    });
  });

  describe('buildVolumeSegments', () => {
    it('returns empty array for empty chapters', () => {
      expect(buildVolumeSegments([])).toEqual([]);
    });

    it('groups adjacent chapters of the same volume and calculates geometry', () => {
      const chs: InspectorChapter[] = [
        { id: 'c1', title: '1', volume_id: 'v1' },
        { id: 'c2', title: '2', volume_id: 'v1' },
        { id: 'c3', title: '3', volume_id: '' },
        { id: 'c4', title: '4', volume_id: 'v2' },
      ];
      const segs = buildVolumeSegments(chs, [
        { id: 'v1', title: 'Том 1' },
        { id: 'v2', title: '' },
      ]);

      expect(segs).toHaveLength(3);
      expect(segs[0]).toMatchObject({
        volumeId: 'v1',
        volumeTitle: 'Том 1',
        startIndex: 0,
        count: 2,
        leftPx: 130,
        widthPx: 250,
        boundaryLeftPx: undefined,
      });
      expect(segs[1]).toMatchObject({
        volumeId: 'default',
        volumeTitle: 'Основной том',
        startIndex: 2,
        count: 1,
        boundaryLeftPx: 270,
      });
      expect(segs[2]).toMatchObject({
        volumeId: 'v2',
        volumeTitle: 'Том v2',
        startIndex: 3,
        count: 1,
      });
    });
  });

  describe('calculateConnectionLines', () => {
    const chapters: InspectorChapter[] = [
      { id: 'chapter:c1', title: 'Ch1', sort_order: 1 },
      { id: 'chapter:c2', title: 'Ch2', sort_order: 2 },
    ];
    const events: InspectorEvent[] = [
      {
        id: 'ev:1',
        title: 'Event 1',
        m_abs: 100,
        participants: [],
        reveals: [
          { chapter_id: 'chapter:c1', chapter_title: 'Ch1', chapter_order: 1, kind: 'normal' },
          { chapter_id: 'chapter:c2', chapter_title: 'Ch2', chapter_sort_order: 2, kind: 'flashback' },
        ],
      },
      {
        id: 'ev:2',
        title: 'Event 2',
        m_abs: 200,
        participants: [],
        reveals: [{ chapter_id: 'chapter:c1', chapter_title: 'Ch1', kind: 'normal' }],
      },
    ];

    it('returns empty array when linkMode is none or lists are empty', () => {
      expect(
        calculateConnectionLines({
          linkMode: 'none',
          chapters,
          events,
          activeChapterId: null,
          hoveredChapterId: null,
          hoveredEventId: null,
        })
      ).toEqual([]);
      expect(
        calculateConnectionLines({
          linkMode: 'all',
          chapters: [],
          events,
          activeChapterId: null,
          hoveredChapterId: null,
          hoveredEventId: null,
        })
      ).toEqual([]);
    });

    it('returns all lines in "all" mode and filters in "focus" mode', () => {
      const all = calculateConnectionLines({
        linkMode: 'all',
        chapters,
        events,
        activeChapterId: null,
        hoveredChapterId: null,
        hoveredEventId: null,
      });
      expect(all).toHaveLength(3);
      expect(all[1].isFlashback).toBe(true);

      const focusCh = calculateConnectionLines({
        linkMode: 'focus',
        chapters,
        events,
        activeChapterId: null,
        hoveredChapterId: 'chapter:c2',
        hoveredEventId: null,
      });
      expect(focusCh).toHaveLength(1);
      expect(focusCh[0].chapterId).toBe('chapter:c2');

      const focusEv = calculateConnectionLines({
        linkMode: 'focus',
        chapters,
        events,
        activeChapterId: null,
        hoveredChapterId: null,
        hoveredEventId: 'ev:2',
      });
      expect(focusEv).toHaveLength(1);
      expect(focusEv[0].eventId).toBe('ev:2');

      const focusNone = calculateConnectionLines({
        linkMode: 'focus',
        chapters,
        events,
        activeChapterId: null,
        hoveredChapterId: null,
        hoveredEventId: null,
      });
      expect(focusNone).toEqual([]);
    });
  });

  describe('calculateSceneHierarchyLines', () => {
    it('returns empty array for empty events and builds arcs for valid parent_id', () => {
      expect(calculateSceneHierarchyLines({ events: [] })).toEqual([]);

      const events: InspectorEvent[] = [
        { id: 'event:p1', title: 'Parent', m_abs: 10, reveals: [], participants: [] },
        { id: 'event:c1', title: 'Child', m_abs: 20, parent_id: 'event:p1', reveals: [], participants: [] },
        { id: 'event:orphan', title: 'Orphan', m_abs: 30, parent_id: 'event:missing', reveals: [], participants: [] },
        { id: 'event:self', title: 'Self', m_abs: 40, parent_id: 'event:self', reveals: [], participants: [] },
      ];

      const lines = calculateSceneHierarchyLines({ events, startX: 50, eventSpacing: 100 });
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        id: 'scene-link-p1-c1',
        parentId: 'p1',
        childId: 'c1',
        x1: 50,
        x2: 150,
        y1: 295,
        y2: 295,
        yBottom: 320,
      });
    });
  });
});


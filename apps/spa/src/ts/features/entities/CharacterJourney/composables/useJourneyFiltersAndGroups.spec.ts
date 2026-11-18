import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useJourneyFiltersAndGroups } from './useJourneyFiltersAndGroups';
import type { JourneyTimelineItem, CharacterJourneyViewMode } from '../CharacterJourney.model';

describe('useJourneyFiltersAndGroups', () => {
  const baseItems: JourneyTimelineItem[] = [
    {
      id: '1',
      type: 'appearance',
      title: 'App',
      subtitle: '',
      fullText: '',
      phaseLabel: '',
      chapter_order: 2,
      m_abs: 2000,
      arc_id: 'story_arcs:a1',
      arc_title: 'Арка 1',
      arc_color: '#f00',
    },
    {
      id: '2',
      type: 'promise',
      kind: 'gun',
      title: 'Promise',
      subtitle: '',
      fullText: '',
      phaseLabel: '',
      chapter_order: 3,
      m_abs: 500, // Earlier in time than item 1 -> flashback in manuscript mode
      allArcIds: ['story_arcs:a2'],
      boundArcs: [{ arcId: 'story_arcs:a2', arcTitle: 'Связанная арка', arcColor: '#0f0', phase: 'climax' }],
    },
    {
      id: '3',
      type: 'event',
      title: 'Event',
      subtitle: '',
      fullText: '',
      phaseLabel: '',
      chapter_order: 1,
      m_abs: 2000, // Equal m_abs to item 1 -> tie-break by chapter_order
    },
    {
      id: '4',
      type: 'relation_change',
      title: 'Rel',
      subtitle: '',
      fullText: '',
      phaseLabel: '',
    },
  ];

  it('filters by type and arc filter, sorts in CHRONOLOGY vs MANUSCRIPT mode, detects flashbacks, and groups arcs', () => {
    const allTimelineItems = ref(baseItems);
    const storyArcs = ref([{ id: 'story_arcs:a1', title: 'Арка 1', color: '#111' } as any, { id: '', title: 'NoId' } as any]);
    const viewMode = ref<CharacterJourneyViewMode>('CHRONOLOGY');
    const selectedArcFilter = ref('ALL');
    const filterType = ref('all');

    const { filteredTimelineItems, arcGroups } = useJourneyFiltersAndGroups({
      allTimelineItems,
      storyArcs,
      viewMode,
      selectedArcFilter,
      filterType,
    });

    // CHRONOLOGY sort: item 4 (0), item 2 (500), item 3 (2000, ch 1), item 1 (2000, ch 2)
    expect(filteredTimelineItems.value.map((i) => i.id)).toEqual(['4', '2', '3', '1']);
    expect(arcGroups.value.map((g) => g.arcId)).toEqual(['story_arcs:a1', 'story_arcs:a2', 'UNASSIGNED']);

    // MANUSCRIPT mode detects flashback on item 2 (m_abs 500 < 2000)
    viewMode.value = 'MANUSCRIPT';
    expect(filteredTimelineItems.value.find((i) => i.id === '2')?.isFlashback).toBe(true);

    // Filter types
    filterType.value = 'scenes';
    expect(filteredTimelineItems.value.map((i) => i.id)).toEqual(['1']);
    filterType.value = 'promises';
    expect(filteredTimelineItems.value.map((i) => i.id)).toEqual(['2']);
    filterType.value = 'events';
    expect(filteredTimelineItems.value.map((i) => i.id)).toEqual(['3']);
    filterType.value = 'relations';
    expect(filteredTimelineItems.value.map((i) => i.id)).toEqual(['4']);

    // Arc filters
    filterType.value = 'all';
    selectedArcFilter.value = 'ALL_ARCS';
    expect(filteredTimelineItems.value.map((i) => i.id)).toEqual(['1', '2']);

    selectedArcFilter.value = 'UNASSIGNED';
    expect(filteredTimelineItems.value.map((i) => i.id)).toEqual(['4', '3']);

    selectedArcFilter.value = 'a1';
    expect(filteredTimelineItems.value.map((i) => i.id)).toEqual(['1']);
  });
});

import { computed, type Ref } from 'vue';
import type { StoryArc } from '@/types/generated/StoryArc';
import type {
  JourneyTimelineItem,
  CharacterJourneyViewMode,
  ArcGroup,
} from '../CharacterJourney.model';
import { formatFlashbackDelta } from './useJourneyChronology';

interface FilterDeps {
  allTimelineItems: Ref<JourneyTimelineItem[]>;
  storyArcs: Ref<StoryArc[]>;
  viewMode: Ref<CharacterJourneyViewMode>;
  selectedArcFilter: Ref<string>;
  filterType: Ref<string>;
}

export function useJourneyFiltersAndGroups(deps: FilterDeps) {
  const { allTimelineItems, storyArcs, viewMode, selectedArcFilter, filterType } = deps;

  const filteredTimelineItems = computed<JourneyTimelineItem[]>(() => {
    let items = allTimelineItems.value.filter((item) => {
      if (filterType.value === 'scenes') {
        const isScenePromise = item.type === 'promise' && (!item.kind || item.kind === 'scene');
        const isAppearance = item.type === 'appearance';
        if (!isScenePromise && !isAppearance) return false;
      } else if (filterType.value === 'promises') {
        if (item.type !== 'promise' || item.kind === 'scene') return false;
      } else if (filterType.value === 'events') {
        if (item.type !== 'event') return false;
      } else if (filterType.value === 'relations') {
        if (item.type !== 'relation_change') return false;
      }

      if (selectedArcFilter.value !== 'ALL') {
        const itemArcs = item.allArcIds && item.allArcIds.length > 0
          ? item.allArcIds
          : (item.arc_id ? [item.arc_id] : []);

        if (selectedArcFilter.value === 'UNASSIGNED') {
          if (itemArcs.length > 0) return false;
        } else {
          const cleanFilter = selectedArcFilter.value.replace(/^story_arcs:/, '');
          const matches = itemArcs.some((id) => (id || '').replace(/^story_arcs:/, '') === cleanFilter);
          if (!matches) {
            return false;
          }
        }
      }

      return true;
    });

    if (viewMode.value === 'CHRONOLOGY') {
      items = [...items].sort((a, b) => {
        const mAbsA = a.m_abs ?? (a.chapter_order ? a.chapter_order * 1000 : 0);
        const mAbsB = b.m_abs ?? (b.chapter_order ? b.chapter_order * 1000 : 0);
        return mAbsA - mAbsB;
      });
    } else {
      items = [...items].sort((a, b) => {
        const orderA = a.chapter_order ?? (a.m_abs ? Math.floor(a.m_abs / 1000) : 0);
        const orderB = b.chapter_order ?? (b.m_abs ? Math.floor(b.m_abs / 1000) : 0);
        if (orderA !== orderB) return orderA - orderB;
        return (a.paragraph_index ?? 0) - (b.paragraph_index ?? 0);
      });
    }

    let lastSeenMabs: number | null = null;
    return items.map((item) => {
      let isFlashback = false;
      let flashbackDeltaLabel: string | undefined = undefined;

      if (viewMode.value !== 'CHRONOLOGY' && item.m_abs !== undefined && item.m_abs !== null) {
        if (lastSeenMabs !== null && item.m_abs < lastSeenMabs) {
          isFlashback = true;
          const delta = lastSeenMabs - item.m_abs;
          flashbackDeltaLabel = formatFlashbackDelta(delta);
        }
        lastSeenMabs = item.m_abs;
      }

      return {
        ...item,
        isFlashback,
        flashbackDeltaLabel,
      };
    });
  });

  const arcGroups = computed<ArcGroup[]>(() => {
    const groupsMap = new Map<string, ArcGroup>();

    storyArcs.value.forEach((arc) => {
      if (arc.id) {
        const cleanKey = arc.id.replace(/^story_arcs:/, '');
        groupsMap.set(cleanKey, {
          arcId: arc.id,
          arcTitle: arc.title,
          arcColor: arc.color || undefined,
          items: [],
        });
      }
    });

    const unassignedGroup: ArcGroup = {
      arcId: 'UNASSIGNED',
      arcTitle: '🌿 Вне сюжетных арок',
      arcColor: 'var(--text-muted)',
      items: [],
    };

    filteredTimelineItems.value.forEach((item) => {
      const itemArcs = item.allArcIds && item.allArcIds.length > 0
        ? item.allArcIds
        : (item.arc_id ? [item.arc_id] : []);

      if (itemArcs.length === 0) {
        unassignedGroup.items.push(item);
      } else {
        itemArcs.forEach((arcId) => {
          const cleanArcKey = (arcId || '').replace(/^story_arcs:/, '');
          if (cleanArcKey && groupsMap.has(cleanArcKey)) {
            groupsMap.get(cleanArcKey)!.items.push(item);
          } else if (cleanArcKey) {
            const boundMatch = item.boundArcs?.find(
              (b) => b.arcId.replace(/^story_arcs:/, '') === cleanArcKey
            );
            groupsMap.set(cleanArcKey, {
              arcId: boundMatch?.arcId || arcId,
              arcTitle: boundMatch?.arcTitle || item.arc_title || 'Сюжетная арка',
              arcColor: boundMatch?.arcColor || item.arc_color || undefined,
              items: [item],
            });
          }
        });
      }
    });

    const result = Array.from(groupsMap.values()).filter((g) => g.items.length > 0);
    if (unassignedGroup.items.length > 0) {
      result.push(unassignedGroup);
    }
    return result;
  });

  return {
    filteredTimelineItems,
    arcGroups,
  };
}

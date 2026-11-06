import { ref, computed } from 'vue';
import type { ArcGroup } from '../../CharacterJourney.model';

export function useJourneyArcGroups(getArcGroups: () => ArcGroup[]) {
  const collapsedArcs = ref<Set<string>>(new Set());

  const toggleArc = (arcId: string) => {
    if (collapsedArcs.value.has(arcId)) {
      collapsedArcs.value.delete(arcId);
    } else {
      collapsedArcs.value.add(arcId);
    }
  };

  const isArcCollapsed = (arcId: string): boolean => {
    return collapsedArcs.value.has(arcId);
  };

  const totalScenesCount = computed(() => {
    return getArcGroups().reduce((acc, g) => acc + g.items.length, 0);
  });

  return {
    collapsedArcs,
    toggleArc,
    isArcCollapsed,
    totalScenesCount,
  };
}

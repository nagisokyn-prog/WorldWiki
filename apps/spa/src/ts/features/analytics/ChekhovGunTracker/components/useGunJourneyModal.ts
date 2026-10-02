import { computed } from 'vue';
import type { ItemJourneyReport, ItemJourneyNode } from '../ChekhovGunTracker.model';

export function useGunJourneyModal(journeyGetter: () => ItemJourneyReport | null) {
  const journey = computed(() => journeyGetter());

  const hasNodes = computed(() => (journey.value?.nodes?.length ?? 0) > 0);

  const nodes = computed<ItemJourneyNode[]>(() => journey.value?.nodes ?? []);

  const getNodeIcon = (nodeType: string): string => {
    switch (nodeType) {
      case 'creation':
        return '🌱';
      case 'custody':
        return '👤';
      case 'scene':
        return '⚡';
      case 'destruction':
        return '💥';
      default:
        return '📍';
    }
  };

  const getNodeBadgeClass = (nodeType: string): string => {
    switch (nodeType) {
      case 'creation':
        return 'bg-success/10 text-success border-success/30';
      case 'custody':
        return 'bg-primary/10 text-primary border-primary/30';
      case 'scene':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'destruction':
        return 'bg-danger/10 text-danger border-danger/30';
      default:
        return 'bg-surface-hover text-muted border-border';
    }
  };

  return {
    journey,
    hasNodes,
    nodes,
    getNodeIcon,
    getNodeBadgeClass,
  };
}

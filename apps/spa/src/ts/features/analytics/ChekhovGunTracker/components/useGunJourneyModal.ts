import { computed } from 'vue';
import type { ItemJourneyReport, TrackedItem, GunJourneyModalEmits, ItemJourneyNode } from '../ChekhovGunTracker.model';
import { isGunItem } from '../useChekhovGunTracker';

export function useGunJourneyModal(
  journeyGetter: () => ItemJourneyReport | null,
  activeItemGetter?: () => TrackedItem | null | undefined,
  emit?: GunJourneyModalEmits
) {
  const journey = computed(() => journeyGetter());
  const activeItem = computed(() => activeItemGetter?.() ?? null);

  const hasNodes = computed(() => (journey.value?.nodes?.length ?? 0) > 0);

  const isPromise = computed(() => {
    if (activeItem.value) {
      return isGunItem(activeItem.value);
    }
    const id = journey.value?.item_id || '';
    const it = journey.value?.item_type || '';
    return id.startsWith('plot_promises:') || it.includes('ружь') || it.includes('предзнаменование');
  });

  const modalTitle = computed(() => {
    if (isPromise.value) {
      return journey.value?.item_name || activeItem.value?.name || 'Хронология сюжетного ружья';
    }
    return journey.value?.item_name || activeItem.value?.name || 'Путь предмета';
  });

  const itemTypeLabel = computed(() => {
    return (
      journey.value?.item_type ||
      activeItem.value?.item_type ||
      (isPromise.value ? 'Чеховское ружьё' : 'Артефакт')
    );
  });

  const statusCategoryLabel = computed(() => {
    return journey.value?.status_category || activeItem.value?.status_category || 'Активен';
  });

  const getNodeIcon = (nodeType: string): string => {
    switch (nodeType) {
      case 'creation':
        return '🌱';
      case 'custody':
        return isPromise.value ? '🎭' : '👤';
      case 'scene':
        return isPromise.value ? '🌿' : '⚡';
      case 'destruction':
        return isPromise.value ? '🎯' : '💥';
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
        return isPromise.value
          ? 'bg-primary/15 text-primary border-primary/40'
          : 'bg-danger/10 text-danger border-danger/30';
      default:
        return 'bg-surface-hover text-muted border-border';
    }
  };

  const emptyText = computed(() => {
    if (isPromise.value) {
      return 'Вехи развития этого сюжетного ружья в тексте пока отсутствуют.';
    }
    return 'История владения и упоминания данного предмета в тексте пока отсутствуют.';
  });

  const nodes = computed(() => (journey.value?.nodes ?? []).map((node) => ({
    ...node,
    icon: getNodeIcon(node.node_type),
    badgeClass: getNodeBadgeClass(node.node_type),
  })));

  function onLocateNode(node: ItemJourneyNode) {
    if (!node.chapter_id) return;
    emit?.('locate-node', {
      chapterId: node.chapter_id,
      paragraphIndex: node.paragraph_index ?? 0,
      quote: node.quote || node.description || '',
      blockId: node.block_id || undefined,
    });
    emit?.('jump-to-chapter', node.chapter_id);
    emit?.('close');
  }

  return {
    journey,
    activeItem,
    isPromise,
    modalTitle,
    itemTypeLabel,
    statusCategoryLabel,
    emptyText,
    hasNodes,
    nodes,
    getNodeIcon,
    getNodeBadgeClass,
    onLocateNode,
  };
}

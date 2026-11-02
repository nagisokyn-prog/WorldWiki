import { computed } from 'vue';
import { getActivePinia } from 'pinia';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { useChapterStore } from '@/stores/chapter.store';
import type { ContradictionAnomalyDto } from '../ConsistencyChecker.model';

export function useAuditAnomalyCard(anomaly: () => ContradictionAnomalyDto) {
  const analyticsStore = getActivePinia() ? useAnalyticsStore() : null;
  const chapterStore = getActivePinia() ? useChapterStore() : null;

  const ruleEmoji = computed(() => {
    const r = String(anomaly().rule).toLowerCase();
    if (r.includes('deceased') || r.includes('death')) return '💀';
    if (r.includes('birth')) return '👶';
    if (r.includes('bilocation')) return '⚡';
    if (r.includes('item') || r.includes('chekhov')) return '🗡️';
    if (r.includes('custody')) return '👑';
    if (r.includes('reveal')) return '🔄';
    if (r.includes('promise') || r.includes('cliffhanger')) return '⏳';
    if (r.includes('location')) return '🏰';
    return '⚠️';
  });

  const ruleTooltip = computed(() => {
    return `Правило: ${anomaly().rule}`;
  });

  function cleanId(id: string): string {
    if (!id) return '';
    return id.replace(/^(entities:|chapters:|timeline_events:|plot_promises:)/, '');
  }

  const uniqueEntityIds = computed(() => {
    return Array.from(new Set(anomaly().entity_ids || []));
  });

  const uniqueChapterIds = computed(() => {
    return Array.from(new Set(anomaly().chapter_ids || []));
  });

  function getEntityLabel(id: string): string {
    if (!id) return '';
    const clean = cleanId(id);
    const ent = analyticsStore?.matrixData?.entities?.find(
      (e) => cleanId(e.id) === clean || e.name === id
    );
    if (ent?.name) return ent.name;
    return clean;
  }

  function getChapterLabel(id: string): string {
    if (!id) return '';
    const clean = cleanId(id);
    const chInStore = chapterStore?.hierarchy?.chapters?.find(
      (c) => cleanId(String(c.id)) === clean
    );
    if (chInStore?.title) return chInStore.title;

    const chInMatrix = analyticsStore?.matrixData?.chapters?.find(
      (c) => cleanId(c.id) === clean
    );
    if (chInMatrix?.title) return chInMatrix.title;

    return clean.startsWith('chapter_') ? 'Глава' : clean;
  }

  return {
    ruleEmoji,
    ruleTooltip,
    cleanId,
    uniqueEntityIds,
    uniqueChapterIds,
    getEntityLabel,
    getChapterLabel,
  };
}

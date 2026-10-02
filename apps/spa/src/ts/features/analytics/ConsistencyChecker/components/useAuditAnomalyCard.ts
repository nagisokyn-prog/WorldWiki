import { computed } from 'vue';
import type { ContradictionAnomalyDto } from '../ConsistencyChecker.model';

export function useAuditAnomalyCard(anomaly: () => ContradictionAnomalyDto) {
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

  return {
    ruleEmoji,
    ruleTooltip,
    cleanId,
  };
}

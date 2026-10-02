import { computed } from 'vue';
import type { AuditSummaryStats } from '../ConsistencyChecker.model';

export function useAuditSummaryHeader(summary: () => AuditSummaryStats) {
  const healthIcon = computed(() => {
    const score = summary().healthyPercent;
    if (score >= 90) return '🟢';
    if (score >= 60) return '🟡';
    return '🔴';
  });

  const healthScoreClass = computed(() => {
    const score = summary().healthyPercent;
    if (score >= 90) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-danger';
  });

  return {
    healthIcon,
    healthScoreClass,
  };
}

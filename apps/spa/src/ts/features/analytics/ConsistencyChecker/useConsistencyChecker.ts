import { ref, computed, onMounted } from 'vue';
import { useAnalyticsStore, type ConsistencyViolation } from '@/stores/analytics.store';
import type { ConsistencyAuditSummary } from './ConsistencyChecker.model';

export function useConsistencyChecker(projectId: string) {
  const store = useAnalyticsStore();
  const filterSeverity = ref<string>('all'); // 'all' | 'critical' | 'warning' | 'info'
  const isAuditing = ref<boolean>(false);

  const violations = computed<ConsistencyViolation[]>(() => store.violations);

  const filteredViolations = computed<ConsistencyViolation[]>(() => {
    if (filterSeverity.value === 'all') return store.violations;
    return store.violations.filter((v) => v.severity === filterSeverity.value);
  });

  const summary = computed<ConsistencyAuditSummary>(() => {
    let critical = 0;
    let warning = 0;
    let info = 0;

    store.violations.forEach((v) => {
      if (v.severity === 'critical') critical++;
      else if (v.severity === 'warning') warning++;
      else info++;
    });

    return {
      criticalCount: critical,
      warningCount: warning,
      infoCount: info,
      totalViolations: store.violations.length,
    };
  });

  const runAudit = async () => {
    if (!projectId) return;
    isAuditing.value = true;
    try {
      await store.loadConsistency(projectId);
    } finally {
      isAuditing.value = false;
    }
  };

  onMounted(() => {
    if (projectId && !store.violations.length) {
      void runAudit();
    }
  });

  return {
    violations,
    filteredViolations,
    filterSeverity,
    summary,
    isAuditing,
    runAudit,
  };
}

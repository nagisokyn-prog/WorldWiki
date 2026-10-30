import { ref, computed, onMounted } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics.store';
import type {
  ContradictionAnomalyDto,
  AnomalySeverity,
  AuditSummaryStats,
} from './ConsistencyChecker.model';

export function useConsistencyChecker(projectId: string) {
  const store = useAnalyticsStore();
  const searchQuery = ref<string>('');
  const selectedSeverity = ref<'all' | AnomalySeverity>('all');
  const selectedRule = ref<string>('all');
  const selectedEntityId = ref<string>('');
  const isAuditing = ref<boolean>(false);

  const rawAnomalies = computed<ContradictionAnomalyDto[]>(() => {
    return (store.violations as unknown as ContradictionAnomalyDto[]) || [];
  });

  const hasActiveFilters = computed<boolean>(() => {
    return (
      searchQuery.value.trim().length > 0 ||
      selectedSeverity.value !== 'all' ||
      selectedRule.value !== 'all' ||
      selectedEntityId.value.length > 0
    );
  });

  const filteredAnomalies = computed<ContradictionAnomalyDto[]>(() => {
    let list = rawAnomalies.value;

    if (selectedSeverity.value !== 'all') {
      list = list.filter((a) => a.severity === selectedSeverity.value);
    }

    if (selectedRule.value !== 'all') {
      const targetRule = selectedRule.value.toLowerCase();
      list = list.filter((a) => String(a.rule).toLowerCase() === targetRule);
    }

    if (selectedEntityId.value) {
      list = list.filter((a) =>
        a.entity_ids?.some((eid: string) => eid.includes(selectedEntityId.value))
      );
    }

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          String(a.rule).toLowerCase().includes(q)
      );
    }

    return list;
  });

  const summary = computed<AuditSummaryStats>(() => {
    if (store.auditReport?.summary) {
      const s = store.auditReport.summary;
      return {
        total: s.total,
        criticalCount: s.critical_count,
        warningCount: s.warning_count,
        noticeCount: s.notice_count,
        healthyPercent: s.healthy_percent,
      };
    }

    let critical = 0;
    let warning = 0;
    let notice = 0;

    rawAnomalies.value.forEach((a) => {
      const sev = (a.severity || '').toLowerCase();
      if (sev === 'critical') critical++;
      else if (sev === 'warning') warning++;
      else notice++;
    });

    const total = rawAnomalies.value.length;
    const penalty = critical * 25 + warning * 10 + notice * 2;
    const healthyPercent = total === 0 ? 100 : Math.max(0, Math.min(100, Math.round(100 - penalty)));

    return {
      total,
      criticalCount: critical,
      warningCount: warning,
      noticeCount: notice,
      healthyPercent,
    };
  });

  const resetFilters = () => {
    searchQuery.value = '';
    selectedSeverity.value = 'all';
    selectedRule.value = 'all';
    selectedEntityId.value = '';
  };

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
    if (projectId && !rawAnomalies.value.length) {
      void runAudit();
    }
  });

  return {
    anomalies: rawAnomalies,
    filteredAnomalies,
    searchQuery,
    selectedSeverity,
    selectedRule,
    selectedEntityId,
    hasActiveFilters,
    summary,
    isAuditing,
    resetFilters,
    runAudit,
  };
}

import { ref, computed, onMounted, toValue, type MaybeRef } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics.store';
import type {
  ContradictionAnomalyDto,
  AnomalySeverity,
  AuditSummaryStats,
} from './ConsistencyChecker.model';

export function useConsistencyChecker(projectIdRef: MaybeRef<string>) {
  const store = useAnalyticsStore();
  const currentView = ref<'anomalies' | 'chapters'>('anomalies');
  const searchQuery = ref<string>('');
  const selectedSeverity = ref<'all' | AnomalySeverity>('all');
  const selectedRule = ref<string>('all');
  const selectedEntityId = ref<string>('');
  const isAuditing = ref<boolean>(false);

  const getProjectId = () => toValue(projectIdRef);

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

  const chapterViolations = computed(() => {
    const map = new Map<string, {
      chapterId: string;
      title: string;
      order: number;
      critical: number;
      warning: number;
      notice: number;
      total: number;
      anomalies: ContradictionAnomalyDto[];
    }>();

    const chapters = store.matrixData?.chapters || [];
    const chapterMap = new Map<string, { title: string; order: number }>();
    chapters.forEach(ch => {
      const clean = ch.id.replace(/^chapters:/, '');
      chapterMap.set(clean, { title: ch.title, order: ch.sort_order });
      chapterMap.set(ch.id, { title: ch.title, order: ch.sort_order });
    });

    rawAnomalies.value.forEach(a => {
      const cids = a.chapter_ids || [];
      cids.forEach(cid => {
        const clean = cid.replace(/^chapters:/, '');
        if (!map.has(clean)) {
          const info = chapterMap.get(clean) || chapterMap.get(cid);
          map.set(clean, {
            chapterId: cid,
            title: info?.title || `Глава ${clean}`,
            order: info?.order ?? 999,
            critical: 0,
            warning: 0,
            notice: 0,
            total: 0,
            anomalies: [],
          });
        }
        const item = map.get(clean)!;
        item.total++;
        item.anomalies.push(a);
        const sev = (a.severity || '').toLowerCase();
        if (sev === 'critical') item.critical++;
        else if (sev === 'warning') item.warning++;
        else item.notice++;
      });
    });

    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  });

  const resetFilters = () => {
    searchQuery.value = '';
    selectedSeverity.value = 'all';
    selectedRule.value = 'all';
    selectedEntityId.value = '';
  };

  const runAudit = async () => {
    const pId = getProjectId();
    if (!pId) return;
    isAuditing.value = true;
    try {
      await store.loadConsistency(pId);
      if (!store.matrixData) {
        await store.loadMatrix(pId);
      }
    } finally {
      isAuditing.value = false;
    }
  };

  onMounted(() => {
    const pId = getProjectId();
    if (pId && !rawAnomalies.value.length) {
      void runAudit();
    }
  });

  return {
    currentView,
    chapterViolations,
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

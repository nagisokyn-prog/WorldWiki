import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConsistencyChecker } from './useConsistencyChecker';
import { useAnalyticsStore } from '@/stores/analytics.store';
import * as apiClient from '@/services/api.client';

vi.mock('@/services/api.client', () => ({
  getCrossReferenceMatrix: vi.fn(),
  auditManuscriptConsistency: vi.fn(),
  getManuscriptStatistics: vi.fn(),
}));

describe('useConsistencyChecker Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const sampleAnomalies = [
    {
      rule: 'deceased_entity_active',
      severity: 'critical',
      title: 'Действие после смерти',
      description: 'Персонаж Артур замечен в главе 5 после гибели в главе 3',
      entity_ids: ['entities:arthur'],
      chapter_ids: ['chapters:ch_5'],
      event_ids: [],
      promise_ids: [],
    },
    {
      rule: 'action_before_birth',
      severity: 'critical',
      title: 'Действие до рождения',
      description: 'Персонаж Алиса участвует в битве до своего рождения',
      entity_ids: ['entities:alice'],
      chapter_ids: ['chapters:ch_1'],
      event_ids: [],
      promise_ids: [],
    },
    {
      rule: 'entity_bilocation',
      severity: 'warning',
      title: 'Временная билокация',
      description: 'Персонаж Мерлин находится в двух сценах в одно и то же время',
      entity_ids: ['entities:merlin'],
      chapter_ids: ['chapters:ch_2', 'chapters:ch_3'],
      event_ids: [],
      promise_ids: [],
    },
    {
      rule: 'forgotten_plot_promise',
      severity: 'notice',
      title: 'Забытое ружье',
      description: 'Кинжал упомянут в главе 1, но не получил развития к финалу тома',
      entity_ids: [],
      chapter_ids: ['chapters:ch_1'],
      event_ids: [],
      promise_ids: ['plot_promises:p1'],
    },
  ];

  it('runs audit and calculates summary statistics and health score', async () => {
    useAnalyticsStore();
    vi.mocked(apiClient.auditManuscriptConsistency).mockResolvedValueOnce({
      summary: {
        total: 4,
        critical_count: 2,
        warning_count: 1,
        notice_count: 1,
        healthy_percent: 38,
      },
      anomalies: sampleAnomalies,
    });

    const { runAudit, summary, anomalies, isAuditing } = useConsistencyChecker('test_proj');

    expect(isAuditing.value).toBe(false);
    await runAudit();

    expect(anomalies.value).toHaveLength(4);
    expect(summary.value.total).toBe(4);
    expect(summary.value.criticalCount).toBe(2);
    expect(summary.value.warningCount).toBe(1);
    expect(summary.value.noticeCount).toBe(1);

    expect(summary.value.healthyPercent).toBe(38);
  });

  it('returns 100% health score when zero anomalies found', async () => {
    useAnalyticsStore();
    vi.mocked(apiClient.auditManuscriptConsistency).mockResolvedValueOnce({
      summary: {
        total: 0,
        critical_count: 0,
        warning_count: 0,
        notice_count: 0,
        healthy_percent: 100,
      },
      anomalies: [],
    });

    const { runAudit, summary, anomalies } = useConsistencyChecker('test_clean_proj');
    await runAudit();

    expect(anomalies.value).toHaveLength(0);
    expect(summary.value.total).toBe(0);
    expect(summary.value.healthyPercent).toBe(100);
  });

  it('correctly maps backend ConsistencyAuditReport with precalculated summary', async () => {
    useAnalyticsStore();
    vi.mocked(apiClient.auditManuscriptConsistency).mockResolvedValueOnce({
      summary: {
        total: 2,
        critical_count: 1,
        warning_count: 1,
        notice_count: 0,
        healthy_percent: 65,
      },
      anomalies: sampleAnomalies.slice(0, 2),
    });

    const { runAudit, summary, anomalies } = useConsistencyChecker('test_backend_report');
    await runAudit();

    expect(anomalies.value).toHaveLength(2);
    expect(summary.value.total).toBe(2);
    expect(summary.value.criticalCount).toBe(1);
    expect(summary.value.warningCount).toBe(1);
    expect(summary.value.noticeCount).toBe(0);
    expect(summary.value.healthyPercent).toBe(65);
  });

  it('filters anomalies by severity', async () => {
    useAnalyticsStore();
    vi.mocked(apiClient.auditManuscriptConsistency).mockResolvedValueOnce(sampleAnomalies);

    const { runAudit, filteredAnomalies, selectedSeverity } = useConsistencyChecker('test_proj');
    await runAudit();

    // Critical filter
    selectedSeverity.value = 'critical';
    expect(filteredAnomalies.value).toHaveLength(2);
    expect(filteredAnomalies.value.every((a) => a.severity === 'critical')).toBe(true);

    // Warning filter
    selectedSeverity.value = 'warning';
    expect(filteredAnomalies.value).toHaveLength(1);
    expect(filteredAnomalies.value[0].rule).toBe('entity_bilocation');

    // Notice filter
    selectedSeverity.value = 'notice';
    expect(filteredAnomalies.value).toHaveLength(1);
    expect(filteredAnomalies.value[0].rule).toBe('forgotten_plot_promise');
  });

  it('filters anomalies by rule type', async () => {
    useAnalyticsStore();
    vi.mocked(apiClient.auditManuscriptConsistency).mockResolvedValueOnce(sampleAnomalies);

    const { runAudit, filteredAnomalies, selectedRule } = useConsistencyChecker('test_proj');
    await runAudit();

    selectedRule.value = 'deceased_entity_active';
    expect(filteredAnomalies.value).toHaveLength(1);
    expect(filteredAnomalies.value[0].entity_ids).toContain('entities:arthur');
  });

  it('filters anomalies by entity ID', async () => {
    useAnalyticsStore();
    vi.mocked(apiClient.auditManuscriptConsistency).mockResolvedValueOnce(sampleAnomalies);

    const { runAudit, filteredAnomalies, selectedEntityId } = useConsistencyChecker('test_proj');
    await runAudit();

    selectedEntityId.value = 'merlin';
    expect(filteredAnomalies.value).toHaveLength(1);
    expect(filteredAnomalies.value[0].title).toContain('билокация');
  });

  it('filters anomalies by search query', async () => {
    useAnalyticsStore();
    vi.mocked(apiClient.auditManuscriptConsistency).mockResolvedValueOnce(sampleAnomalies);

    const { runAudit, filteredAnomalies, searchQuery } = useConsistencyChecker('test_proj');
    await runAudit();

    searchQuery.value = 'кинжал';
    expect(filteredAnomalies.value).toHaveLength(1);
    expect(filteredAnomalies.value[0].rule).toBe('forgotten_plot_promise');
  });

  it('detects active filters and resets filters correctly', async () => {
    useAnalyticsStore();
    vi.mocked(apiClient.auditManuscriptConsistency).mockResolvedValueOnce(sampleAnomalies);

    const {
      runAudit,
      searchQuery,
      selectedSeverity,
      selectedRule,
      selectedEntityId,
      hasActiveFilters,
      resetFilters,
      filteredAnomalies,
    } = useConsistencyChecker('test_proj');
    await runAudit();

    expect(hasActiveFilters.value).toBe(false);

    searchQuery.value = 'Мерлин';
    expect(hasActiveFilters.value).toBe(true);

    selectedSeverity.value = 'warning';
    selectedRule.value = 'entity_bilocation';
    selectedEntityId.value = 'merlin';

    resetFilters();

    expect(searchQuery.value).toBe('');
    expect(selectedSeverity.value).toBe('all');
    expect(selectedRule.value).toBe('all');
    expect(selectedEntityId.value).toBe('');
    expect(hasActiveFilters.value).toBe(false);
    expect(filteredAnomalies.value).toHaveLength(4);
  });
});

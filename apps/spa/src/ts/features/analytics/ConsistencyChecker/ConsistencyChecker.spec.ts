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

  it('runs audit and calculates summary counts', async () => {
    useAnalyticsStore();
    vi.mocked(apiClient.auditManuscriptConsistency).mockResolvedValueOnce([
      { rule_id: 'dead_character_speaks', severity: 'critical', title: 'Мертвый персонаж в сцене', description: '...' },
      { rule_id: 'premature_reveal', severity: 'warning', title: 'Раскрытие до события', description: '...' },
      { rule_id: 'location_destroyed', severity: 'warning', title: 'Разрушенная локация', description: '...' },
    ]);

    const { runAudit, summary, filteredViolations, filterSeverity } = useConsistencyChecker('test_proj');

    await runAudit();

    expect(summary.value.criticalCount).toBe(1);
    expect(summary.value.warningCount).toBe(2);
    expect(summary.value.totalViolations).toBe(3);

    // Filter by critical
    filterSeverity.value = 'critical';
    expect(filteredViolations.value).toHaveLength(1);
    expect(filteredViolations.value[0].rule_id).toBe('dead_character_speaks');
  });
});

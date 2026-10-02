import { describe, it, expect } from 'vitest';
import { useAuditSummaryHeader } from './useAuditSummaryHeader';
import type { AuditSummaryStats } from '../ConsistencyChecker.model';

describe('useAuditSummaryHeader Composable', () => {
  it('returns green icon and success class for health >= 90', () => {
    const stats: AuditSummaryStats = {
      total: 1,
      criticalCount: 0,
      warningCount: 0,
      noticeCount: 1,
      healthyPercent: 98,
    };
    const { healthIcon, healthScoreClass } = useAuditSummaryHeader(() => stats);
    expect(healthIcon.value).toBe('🟢');
    expect(healthScoreClass.value).toBe('text-success');
  });

  it('returns yellow icon and warning class for health between 60 and 89', () => {
    const stats: AuditSummaryStats = {
      total: 3,
      criticalCount: 0,
      warningCount: 2,
      noticeCount: 1,
      healthyPercent: 78,
    };
    const { healthIcon, healthScoreClass } = useAuditSummaryHeader(() => stats);
    expect(healthIcon.value).toBe('🟡');
    expect(healthScoreClass.value).toBe('text-warning');
  });

  it('returns red icon and danger class for health < 60', () => {
    const stats: AuditSummaryStats = {
      total: 4,
      criticalCount: 2,
      warningCount: 1,
      noticeCount: 1,
      healthyPercent: 38,
    };
    const { healthIcon, healthScoreClass } = useAuditSummaryHeader(() => stats);
    expect(healthIcon.value).toBe('🔴');
    expect(healthScoreClass.value).toBe('text-danger');
  });
});

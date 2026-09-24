export type { ConsistencyViolation } from '@/stores/analytics.store';

export type ViolationSeverity = 'critical' | 'warning' | 'info';

export interface ConsistencyAuditSummary {
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  totalViolations: number;
}

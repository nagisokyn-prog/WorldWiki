import type { ConsistencyViolation } from '@/stores/analytics.store';

export type AnomalySeverity = 'critical' | 'warning' | 'notice' | 'info';
export type ContradictionAnomalyDto = ConsistencyViolation;
export interface AuditSummaryStats {
  total: number;
  criticalCount: number;
  warningCount: number;
  noticeCount: number;
  healthyPercent: number;
}

export interface ConsistencyCheckerProps {
  projectId?: string;
  project?: string;
}

export type ConsistencyCheckerEmits = {
  (e: 'jumpToChapter', chapterId: string): void;
  (e: 'openEntity', entityId: string): void;
};

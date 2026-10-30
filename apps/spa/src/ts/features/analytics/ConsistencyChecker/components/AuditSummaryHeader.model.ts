import type { AuditSummaryStats } from '../ConsistencyChecker.model'

export interface AuditSummaryHeaderProps {
  summary: AuditSummaryStats;
    isAuditing: boolean;
}

export type AuditSummaryHeaderEmits = {
  (e: 'refresh'): void;
};

import type { ContradictionAnomalyDto } from '../ConsistencyChecker.model'

export interface AuditAnomalyCardProps {
  anomaly: ContradictionAnomalyDto;
}

export type AuditAnomalyCardEmits = {
  (e: 'jumpToChapter', chapterId: string): void;
    (e: 'openEntity', entityId: string): void;
};

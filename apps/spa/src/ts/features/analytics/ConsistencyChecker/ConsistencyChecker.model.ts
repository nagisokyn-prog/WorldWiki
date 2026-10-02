export type AnomalySeverity = 'critical' | 'warning' | 'notice';

export type AnomalyRuleType =
  | 'deceased_entity_active'
  | 'action_before_birth'
  | 'reveal_before_event'
  | 'destroyed_location_used'
  | 'entity_bilocation'
  | 'forgotten_plot_promise';

export interface ContradictionAnomalyDto {
  rule: AnomalyRuleType | string;
  severity: AnomalySeverity;
  title: string;
  description: string;
  entity_ids: string[];
  chapter_ids: string[];
  event_ids: string[];
  promise_ids: string[];
}

export interface AnomalyFilterState {
  searchQuery: string;
  selectedSeverity: 'all' | AnomalySeverity;
  selectedRule: 'all' | AnomalyRuleType | string;
  selectedEntityId: string;
}

export interface AuditSummaryStats {
  total: number;
  criticalCount: number;
  warningCount: number;
  noticeCount: number;
  healthyPercent: number;
}

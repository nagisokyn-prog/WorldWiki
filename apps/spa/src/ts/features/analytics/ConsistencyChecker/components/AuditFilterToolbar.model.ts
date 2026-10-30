export interface AuditFilterToolbarProps {
  searchQuery: string;
    selectedSeverity: string;
    selectedRule: string;
    hasActiveFilters: boolean;
}

export type AuditFilterToolbarEmits = {
  (e: 'update:searchQuery', val: string): void;
    (e: 'update:selectedSeverity', val: string): void;
    (e: 'update:selectedRule', val: string): void;
    (e: 'resetFilters'): void;
};

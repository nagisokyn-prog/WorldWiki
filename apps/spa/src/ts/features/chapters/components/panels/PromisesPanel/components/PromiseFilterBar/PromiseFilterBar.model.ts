export interface PromiseFilterBarProps {
  scopeFilter: 'all' | 'current';
    statusFilter: string;
    categoryFilter: 'all' | 'scenes' | 'promises';
    totalCount: number;
    chapterCount: number;
    statuses: Array<{ id: string; label: string; icon: string }>;
}

export type PromiseFilterBarEmits = {
  (e: 'update:scopeFilter', val: 'all' | 'current'): void;
    (e: 'update:statusFilter', val: string): void;
    (e: 'update:categoryFilter', val: 'all' | 'scenes' | 'promises'): void;
};

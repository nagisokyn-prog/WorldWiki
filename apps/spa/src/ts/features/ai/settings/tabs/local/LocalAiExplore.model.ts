import type { HfModelItem } from './useLocalAiTab'

export interface LocalAiExploreProps {
  searchQuery: string;
    hfToken: string;
    isSearching: boolean;
    hfModels: HfModelItem[];
    downloadProgress: Record<string, { percent: number }>;
    isModelInstalled: (filename: string) => boolean;
    formatNumber: (num: number) => string;
}

export type LocalAiExploreEmits = {
  (e: 'update:searchQuery', val: string): void;
    (e: 'update:hfToken', val: string): void;
    (e: 'search-input'): void;
    (e: 'save-hf-token'): void;
    (e: 'download', repoId: string, filename: string): void;
};

import type { Volume } from '@/types/generated/Volume';
import type { Chapter } from '@/types/generated/Chapter';

export interface SearchResult<T> {
  entity: T;
  score: number;
  kind: string;
}

export interface AutoExtendResult {
  chapter_id?: string | null;
  volume_id?: string | null;
  updated_count?: number;
}

export interface ChapterHierarchy {
  volumes: (Volume & { sort_order?: number | bigint; [key: string]: unknown })[];
  chapters: (Omit<Chapter, 'sort_order'> & { volume_id?: string | null; sort_order?: number | bigint; [key: string]: unknown })[];
}

export interface ProjectSummary {
  id?: string;
  name: string;
  created_at?: string;
  genres?: string[];
  perfLevel?: string;
  data?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  icon?: string;
  [key: string]: unknown;
}

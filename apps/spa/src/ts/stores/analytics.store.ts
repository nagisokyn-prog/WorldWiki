import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  getCrossReferenceMatrix ,
  getManuscriptStatistics,
  getItemTracker,
  getItemJourney,
} from '../services/api.client';

export interface MatrixChapter {
  id: string;
  title: string;
  volume_id?: string | null;
  sort_order: number;
  word_count: number;
}

export interface MatrixAppearance {
  chapter_id: string;
  kind?: 'scene' | 'mention' | 'both' | 'none' | 'deceased';
  source?: 'mention' | 'manual' | 'scene' | string | null;
  role?: string | null;
  has_scene?: boolean;
  has_mention?: boolean;
  count?: number;
}

export interface MatrixEntity {
  id: string;
  name: string;
  entity_type: string;
  is_deceased?: boolean;
  death_m_abs?: number | null;
  birth_m_abs?: number | null;
  role_in_story?: string | null;
  status_category?: string | null;
  appearances_by_chapter?: MatrixAppearance[];
  appearances?: MatrixAppearance[];
}

export interface CrossReferenceMatrixData {
  chapters: MatrixChapter[];
  entities: MatrixEntity[];
}

export interface ConsistencyViolation {
  rule_id?: string;
  rule?: string;
  severity: 'critical' | 'warning' | 'notice' | 'info';
  title: string;
  description: string;
  entity_id?: string;
  entity_ids?: string[];
  chapter_id?: string;
  chapter_ids?: string[];
  event_id?: string;
  event_ids?: string[];
  promise_ids?: string[];
}

export interface ManuscriptStats {
  total_words: number;
  total_chapters: number;
  total_entities: number;
  pov_distribution: Array<{ name: string; chapter_count: number; percentage: number }>;
  event_density: Array<{ volume_title: string; events_per_chapter: number }>;
  promise_stats: { planted: number; developed: number; resolved: number };
}

export type ItemUsageState = 'active' | 'sleeping' | 'forgotten' | 'destroyed_or_lost';

export interface CustodyEvent {
  owner_id?: string | null;
  owner_name?: string | null;
  chapter_id?: string | null;
  chapter_order?: number | null;
  chapter_title?: string | null;
  m_abs?: number | null;
  circumstances: string;
  status_on_stage?: string | null;
}

export interface TrackedItem {
  id: string;
  name: string;
  item_type: string;
  status_category: string;
  current_owner_id?: string | null;
  current_owner_name?: string | null;
  first_chapter_order?: number | null;
  last_chapter_order?: number | null;
  skipped_chapters: number;
  total_mentions: number;
  usage_state: ItemUsageState;
  custody_chain: CustodyEvent[];
}

export interface ItemTrackerSummary {
  total_items: number;
  active_count: number;
  sleeping_count: number;
  forgotten_count: number;
  destroyed_count: number;
}

export interface ItemTrackerReport {
  summary: ItemTrackerSummary;
  items: TrackedItem[];
}

export interface ItemJourneyNode {
  id: string;
  title: string;
  node_type: 'creation' | 'custody' | 'scene' | 'destruction' | string;
  m_abs?: number | null;
  chapter_order?: number | null;
  chapter_id?: string | null;
  chapter_title?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  description: string;
  quote?: string | null;
  block_id?: string | null;
  paragraph_index?: number | null;
}

export interface ItemJourneyReport {
  item_id: string;
  item_name: string;
  item_type: string;
  status_category: string;
  nodes: ItemJourneyNode[];
}

export const useAnalyticsStore = defineStore('analytics', () => {
  const currentProject = ref<string | null>(null);
  const matrixData = ref<CrossReferenceMatrixData | null>(null);
  const stats = ref<ManuscriptStats | null>(null);
  const itemTracker = ref<ItemTrackerReport | null>(null);
  const itemTrackerLoading = ref<boolean>(false);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  async function loadMatrix(project: string, force = false): Promise<CrossReferenceMatrixData | null> {
    if (!force && matrixData.value && currentProject.value === project) {
      return matrixData.value;
    }
    currentProject.value = project;
    isLoading.value = true;
    error.value = null;
    try {
      console.log('[AnalyticsStore] Loading cross-reference matrix for project:', project);
      const data = await getCrossReferenceMatrix(project);
      console.log('[AnalyticsStore] Cross-reference matrix data received:', data);
      matrixData.value = (data as CrossReferenceMatrixData) || { chapters: [], entities: [] };
      return matrixData.value;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error.value = msg;
      console.error('[AnalyticsStore ERROR] Error loading cross-reference matrix:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function loadStats(project: string): Promise<ManuscriptStats | null> {
    currentProject.value = project;
    try {
      const data = await getManuscriptStatistics(project);
      stats.value = (data as ManuscriptStats) || null;
      return stats.value;
    } catch (err: unknown) {
      console.error('[AnalyticsStore] Error loading manuscript stats:', err);
      stats.value = null;
      return null;
    }
  }

  async function loadItemTracker(project: string, force = false): Promise<ItemTrackerReport | null> {
    if (!force && itemTracker.value && currentProject.value === project) {
      return itemTracker.value;
    }
    currentProject.value = project;
    itemTrackerLoading.value = true;
    try {
      const data = await getItemTracker(project);
      itemTracker.value = (data as ItemTrackerReport) || null;
      return itemTracker.value;
    } catch (err: unknown) {
      console.error('[AnalyticsStore] Error loading item tracker:', err);
      itemTracker.value = null;
      return null;
    } finally {
      itemTrackerLoading.value = false;
    }
  }

  async function loadItemJourney(project: string, itemId: string): Promise<ItemJourneyReport | null> {
    try {
      const data = await getItemJourney(project, itemId);
      return (data as ItemJourneyReport) || null;
    } catch (err: unknown) {
      console.error('[AnalyticsStore] Error loading item journey:', err);
      return null;
    }
  }

  function invalidate() {
    matrixData.value = null;
    stats.value = null;
    itemTracker.value = null;
  }

  return {
    currentProject,
    matrixData,
    stats,
    itemTracker,
    itemTrackerLoading,
    isLoading,
    error,
    loadMatrix,
    loadStats,
    loadItemTracker,
    loadItemJourney,
    invalidate,
  };
});


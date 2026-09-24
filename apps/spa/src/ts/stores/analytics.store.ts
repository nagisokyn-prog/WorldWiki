import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCrossReferenceMatrix, auditManuscriptConsistency, getManuscriptStatistics } from '../services/api.client';

export interface MatrixChapter {
  id: string;
  title: string;
  sort_order: number;
  word_count: number;
}

export interface MatrixAppearance {
  chapter_id: string;
  kind?: 'scene' | 'mention' | 'none' | 'deceased';
  source?: 'mention' | 'manual' | 'scene' | string | null;
  role?: string | null;
}

export interface MatrixEntity {
  id: string;
  name: string;
  entity_type: string;
  is_deceased?: boolean;
  death_m_abs?: number;
  appearances_by_chapter?: MatrixAppearance[];
  appearances?: MatrixAppearance[];
}

export interface CrossReferenceMatrixData {
  chapters: MatrixChapter[];
  entities: MatrixEntity[];
}

export interface ConsistencyViolation {
  rule_id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  entity_id?: string;
  chapter_id?: string;
  event_id?: string;
}

export interface ManuscriptStats {
  total_words: number;
  total_chapters: number;
  total_entities: number;
  pov_distribution: Array<{ name: string; chapter_count: number; percentage: number }>;
  event_density: Array<{ volume_title: string; events_per_chapter: number }>;
  promise_stats: { planted: number; developed: number; resolved: number };
}

export const useAnalyticsStore = defineStore('analytics', () => {
  const currentProject = ref<string | null>(null);
  const matrixData = ref<CrossReferenceMatrixData | null>(null);
  const violations = ref<ConsistencyViolation[]>([]);
  const stats = ref<ManuscriptStats | null>(null);
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
      const data = await getCrossReferenceMatrix(project);
      matrixData.value = (data as CrossReferenceMatrixData) || { chapters: [], entities: [] };
      return matrixData.value;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error.value = msg;
      console.error('[AnalyticsStore] Error loading cross-reference matrix:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function loadConsistency(project: string): Promise<ConsistencyViolation[]> {
    currentProject.value = project;
    try {
      const data = await auditManuscriptConsistency(project);
      violations.value = Array.isArray(data) ? (data as ConsistencyViolation[]) : [];
      return violations.value;
    } catch (err: unknown) {
      console.error('[AnalyticsStore] Error running consistency audit:', err);
      violations.value = [];
      return [];
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

  function invalidate() {
    matrixData.value = null;
    violations.value = [];
    stats.value = null;
  }

  return {
    currentProject,
    matrixData,
    violations,
    stats,
    isLoading,
    error,
    loadMatrix,
    loadConsistency,
    loadStats,
    invalidate,
  };
});

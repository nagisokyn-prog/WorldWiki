import { ref, computed, onMounted } from 'vue';
import {
  useAnalyticsStore,
  type CrossReferenceMatrixData,
  type MatrixChapter,
  type MatrixEntity,
} from '@/stores/analytics.store';
import type {
  CrossReferenceFilterState,
  EntityPresenceRow,
  ChapterColumnSummary,
} from './CrossReferenceMatrix.model';
import {
  buildEntityPresenceRow,
  buildChapterColumns,
  formatWordCount,
  getRoleWeight,
  getEntityIcon,
  getEntityTypeLabel,
} from './crossReferenceMatrix.utils';

export { getRoleWeight, formatWordCount, getEntityIcon, getEntityTypeLabel };

export function useCrossReferenceMatrix(project: string) {
  const store = useAnalyticsStore();

  const filters = ref<CrossReferenceFilterState>({
    searchQuery: '',
    selectedEntityType: 'all',
    selectedVolumeId: 'all',
    showDeceasedOnly: false,
    highlightGaps: true,
  });

  const matrixData = computed<CrossReferenceMatrixData | null>(() => store.matrixData);
  const isLoading = computed(() => store.isLoading);
  const error = computed(() => store.error);

  const availableEntityTypes = computed(() => {
    if (!matrixData.value) return [];
    const set = new Set<string>();
    matrixData.value.entities.forEach((e) => {
      if (e.entity_type) set.add(e.entity_type);
    });
    return Array.from(set).sort();
  });

  const chapters = computed<MatrixChapter[]>(() => {
    if (!matrixData.value) return [];
    return [...matrixData.value.chapters].sort((a, b) => a.sort_order - b.sort_order);
  });

  const rows = computed<EntityPresenceRow[]>(() => {
    if (!matrixData.value) return [];
    const chs = chapters.value;
    const q = filters.value.searchQuery.toLowerCase().trim();

    return matrixData.value.entities
      .filter((entity: MatrixEntity) => {
        const isDeceased = Boolean(entity.is_deceased || entity.status_category === 'Мёртв');
        if (filters.value.selectedEntityType !== 'all' && entity.entity_type !== filters.value.selectedEntityType) {
          return false;
        }
        if (filters.value.showDeceasedOnly && !isDeceased) {
          return false;
        }
        if (q && !entity.name.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .map((entity: MatrixEntity) => buildEntityPresenceRow(entity, chs))
      .sort((a, b) => {
        const weightA = getRoleWeight(a.entity.role_in_story);
        const weightB = getRoleWeight(b.entity.role_in_story);
        if (weightA !== weightB) return weightB - weightA;
        return b.totalAppearances - a.totalAppearances;
      });
  });

  const chapterStats = computed(() => {
    const stats = new Map<string, { scenes: number; mentions: number; total: number }>();
    chapters.value.forEach((ch) => {
      stats.set(ch.id, { scenes: 0, mentions: 0, total: 0 });
    });

    rows.value.forEach((row) => {
      row.cells.forEach((cell, chId) => {
        const current = stats.get(chId);
        if (!current) return;
        if (cell.hasScene) current.scenes++;
        if (cell.hasMention) current.mentions++;
        if (cell.status !== 'absent') current.total++;
      });
    });

    return stats;
  });

  const chapterColumns = computed<ChapterColumnSummary[]>(() => {
    return buildChapterColumns(chapters.value, chapterStats.value);
  });

  const totalProjectAppearances = computed(() => {
    return rows.value.reduce((acc, r) => acc + r.totalAppearances, 0);
  });

  const refresh = async () => {
    if (project) {
      await store.loadMatrix(project, true);
    }
  };

  onMounted(() => {
    if (project && (!store.matrixData || store.currentProject !== project)) {
      void store.loadMatrix(project);
    }
  });

  return {
    filters,
    matrixData,
    chapters,
    chapterColumns,
    rows,
    availableEntityTypes,
    chapterStats,
    totalProjectAppearances,
    isLoading,
    error,
    refresh,
    formatWordCount,
  };
}

import { ref, computed, watch, onMounted, toValue, type MaybeRef } from 'vue';
import {
  useAnalyticsStore,
  type CrossReferenceMatrixData,
  type MatrixChapter,
  type MatrixEntity,
} from '@/stores/analytics.store';
import { useChapterStore } from '@/stores/chapter.store';
import type {
  CrossReferenceFilterState,
  CrossReferenceMatrixProps,
  EntityPresenceRow,
  ChapterColumnSummary,
  MatrixVolumeGroup,
} from './CrossReferenceMatrix.model';
import {
  normalizeCleanId,
  buildEntityPresenceRow,
  buildChapterColumns,
  formatWordCount,
  getRoleWeight,
  getEntityIcon,
  getEntityTypeLabel,
} from './crossReferenceMatrix.utils';

export { getRoleWeight, formatWordCount, getEntityIcon, getEntityTypeLabel };

export function useCrossReferenceMatrix(projectOrProps?: MaybeRef<string> | CrossReferenceMatrixProps) {
  const store = useAnalyticsStore();
  const chapterStore = useChapterStore();

  const getProjectId = () => {
    const val = toValue(projectOrProps);
    if (typeof val === 'object' && val !== null) {
      return (val as CrossReferenceMatrixProps).project || chapterStore.currentChapter?.project_id || 'default';
    }
    return (val as string) || chapterStore.currentChapter?.project_id || 'default';
  };

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

  const volumeOptions = computed(() => {
    const list: Array<{ id: string; title: string }> = [{ id: 'all', title: 'Все тома' }];
    const known = new Set<string>();

    (chapterStore.hierarchy?.volumes || []).forEach((v) => {
      const clean = normalizeCleanId(v.id);
      if (clean && !known.has(clean)) {
        known.add(clean);
        list.push({ id: clean, title: v.title || `Том ${clean}` });
      }
    });

    const allChs = [
      ...(chapterStore.hierarchy?.chapters || chapterStore.chapters || []),
      ...(matrixData.value?.chapters || []),
    ];
    allChs.forEach((c) => {
      const vId = normalizeCleanId(c.volume_id);
      if (vId && !known.has(vId)) {
        known.add(vId);
        list.push({ id: vId, title: `Том ${vId}` });
      }
    });

    return list;
  });

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
    const hierarchyChapters = chapterStore.hierarchy?.chapters || chapterStore.chapters || [];
    const volMap = new Map<string, string>();
    const volOrderMap = new Map<string, number>();
    const volTitleMap = new Map<string, string>();

    (chapterStore.hierarchy?.volumes || []).forEach((v, vIdx) => {
      const cleanV = normalizeCleanId(v.id);
      volOrderMap.set(cleanV, vIdx);
      if (v.title) volTitleMap.set(cleanV, v.title);
    });

    hierarchyChapters.forEach((hc) => {
      const cleanChId = normalizeCleanId(hc.id);
      const cleanVolId = normalizeCleanId(hc.volume_id);
      if (cleanChId && cleanVolId) {
        volMap.set(cleanChId, cleanVolId);
      }
    });

    let list = matrixData.value.chapters.map((c) => {
      const cleanId = normalizeCleanId(c.id);
      const resolvedVol = normalizeCleanId(c.volume_id) || volMap.get(cleanId) || '';
      const rawTitle = (c as unknown as { volume_title?: string }).volume_title;
      const resolvedTitle = rawTitle || volTitleMap.get(resolvedVol) || (resolvedVol ? `Том ${resolvedVol}` : 'Основной том');
      return {
        ...c,
        volume_id: resolvedVol,
        volume_title: resolvedTitle
      };
    });

    if (filters.value.selectedVolumeId && filters.value.selectedVolumeId !== 'all') {
      const cleanVol = normalizeCleanId(filters.value.selectedVolumeId);
      list = list.filter((c) => normalizeCleanId(c.volume_id) === cleanVol);
    }

    return list.sort((a, b) => {
      const vA = volOrderMap.get(normalizeCleanId(a.volume_id)) ?? 0;
      const vB = volOrderMap.get(normalizeCleanId(b.volume_id)) ?? 0;
      if (vA !== vB) return vA - vB;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
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

  const volumeGroups = computed<MatrixVolumeGroup[]>(() => {
    const cols = chapterColumns.value;
    if (!cols.length) return [];
    const volTitleMap = new Map<string, string>();
    (chapterStore.hierarchy?.volumes || []).forEach((v) => {
      volTitleMap.set(normalizeCleanId(v.id), v.title || `Том ${normalizeCleanId(v.id)}`);
    });

    const groups: MatrixVolumeGroup[] = [];
    let currentVolId: string | null = null;
    let currentGroup: MatrixVolumeGroup | null = null;

    for (const col of cols) {
      const vId = normalizeCleanId(col.volume_id) || 'default';
      const vTitle = col.volume_title || volTitleMap.get(vId) || (vId !== 'default' ? `Том ${vId}` : 'Основной том');
      if (vId !== currentVolId || !currentGroup) {
        currentVolId = vId;
        currentGroup = {
          volumeId: vId,
          volumeTitle: vTitle,
          chaptersCount: 1,
        };
        groups.push(currentGroup);
      } else {
        currentGroup.chaptersCount++;
      }
    }

    return groups;
  });

  const totalProjectAppearances = computed(() => {
    return rows.value.reduce((acc, r) => acc + r.totalAppearances, 0);
  });

  const loadData = async (force = false) => {
    const proj = getProjectId();
    if (proj) {
      if (!chapterStore.hierarchy?.volumes?.length) {
        await chapterStore.loadChapters(proj);
      }
      await store.loadMatrix(proj, force);
    }
  };

  const refresh = async () => {
    await loadData(true);
  };

  onMounted(() => {
    void loadData();
  });

  watch(getProjectId, (newProj) => {
    if (newProj) void loadData();
  });

  return {
    filters,
    matrixData,
    volumeOptions,
    volumeGroups,
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

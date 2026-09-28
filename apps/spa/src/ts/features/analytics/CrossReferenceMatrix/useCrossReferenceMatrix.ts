import { ref, computed, onMounted } from 'vue';
import { useAnalyticsStore, type CrossReferenceMatrixData, type MatrixChapter, type MatrixEntity } from '@/stores/analytics.store';
import type { CrossReferenceFilterState, EntityPresenceRow, CellStatusInfo, AppearanceStatus } from './CrossReferenceMatrix.model';

export function getRoleWeight(role?: string | null): number {
  if (!role) return 1;
  const r = role.toLowerCase().trim();
  if (r.includes('главн') || r.includes('main') || r.includes('protagonist')) return 4;
  if (r.includes('антагон') || r.includes('antagonist') || r.includes('злодей')) return 3;
  if (r.includes('второстепен') || r.includes('secondary')) return 2;
  return 1;
}

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
    matrixData.value.entities.forEach(e => {
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
      .map((entity: MatrixEntity): EntityPresenceRow => {
        const cells = new Map<string, CellStatusInfo>();
        let total = 0;
        let lastSeenIdx = -1;
        let maxGap = 0;
        const isDeceased = Boolean(entity.is_deceased || entity.status_category === 'Мёртв');

        const rawApps = entity.appearances_by_chapter || entity.appearances || [];
        const appearancesMap = new Map<string, { kind?: string; source?: string | null; role?: string | null }>();
        rawApps.forEach(app => {
          if (!app.chapter_id) return;
          const cleanId = app.chapter_id.replace(/^chapters:/, '');
          const existing = appearancesMap.get(app.chapter_id);
          const isNewScene = app.kind === 'scene' || app.source === 'scene' || app.source === 'manual';
          if (!existing || isNewScene) {
            appearancesMap.set(app.chapter_id, app);
            appearancesMap.set(cleanId, app);
            appearancesMap.set(`chapters:${cleanId}`, app);
          }
        });

        // Determine the index of the last active appearance or death point
        let lastActiveIdx = -1;
        chs.forEach((ch, idx) => {
          const cleanChId = ch.id.replace(/^chapters:/, '');
          const app = appearancesMap.get(ch.id) || appearancesMap.get(cleanChId) || appearancesMap.get(`chapters:${cleanChId}`);
          if (app && (app.kind === 'scene' || app.kind === 'mention' || app.source === 'scene' || app.source === 'mention' || app.source === 'manual')) {
            lastActiveIdx = idx;
          }
        });

        chs.forEach((ch, idx) => {
          const cleanChId = ch.id.replace(/^chapters:/, '');
          const app = appearancesMap.get(ch.id) || appearancesMap.get(cleanChId) || appearancesMap.get(`chapters:${cleanChId}`);
          
          if (app && (app.kind === 'scene' || app.kind === 'mention' || app.source === 'scene' || app.source === 'mention' || app.source === 'manual')) {
            const isScene = app.kind === 'scene' || app.source === 'scene' || app.source === 'manual';
            const status: AppearanceStatus = isScene ? 'scene' : 'mention';
            cells.set(ch.id, {
              status,
              role: app.role,
              label: isScene ? 'Сцена' : 'Упоминание',
            });
            total++;

            if (lastSeenIdx !== -1) {
              const gap = idx - lastSeenIdx - 1;
              if (gap > maxGap) maxGap = gap;
            }
            lastSeenIdx = idx;
          } else if (app?.kind === 'deceased' || (isDeceased && (lastActiveIdx === -1 || idx > lastActiveIdx))) {
            cells.set(ch.id, {
              status: 'deceased',
              label: 'Погиб',
            });
          } else {
            cells.set(ch.id, {
              status: 'absent',
              label: 'Отсутствует',
            });
          }
        });

        const hasGapWarning = filters.value.highlightGaps && maxGap >= 3 && total > 1;

        return {
          entity,
          cells,
          totalAppearances: total,
          hasGapWarning,
        };
      })
      .sort((a, b) => {
        const roleA = getRoleWeight(a.entity.role_in_story);
        const roleB = getRoleWeight(b.entity.role_in_story);
        if (roleB !== roleA) {
          return roleB - roleA;
        }
        if (b.totalAppearances !== a.totalAppearances) {
          return b.totalAppearances - a.totalAppearances;
        }
        return a.entity.name.localeCompare(b.entity.name, 'ru');
      });
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

  const formatWordCount = (count?: number | null): string => {
    if (!count) return '0 сл.';
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k сл.`;
    }
    return `${count} сл.`;
  };

  return {
    filters,
    matrixData,
    chapters,
    rows,
    availableEntityTypes,
    isLoading,
    error,
    refresh,
    formatWordCount,
  };
}

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
        let totalScenes = 0;
        let totalMentions = 0;
        let lastSeenIdx = -1;
        let maxGap = 0;
        const isDeceased = Boolean(entity.is_deceased || entity.status_category === 'Мёртв');

        interface MergedApp {
          hasScene: boolean;
          hasMention: boolean;
          isDeceased: boolean;
          count: number;
          role?: string | null;
        }
        const appearancesMap = new Map<string, MergedApp>();

        const rawApps = entity.appearances_by_chapter || entity.appearances || [];
        rawApps.forEach(app => {
          if (!app.chapter_id) return;
          const cleanId = app.chapter_id.replace(/^chapters:/, '');
          const existing = appearancesMap.get(cleanId) || {
            hasScene: false,
            hasMention: false,
            isDeceased: false,
            count: 0,
            role: null,
          };

          const isScene = Boolean(app.has_scene || app.kind === 'scene' || app.kind === 'both' || app.source === 'scene' || app.source === 'manual');
          const isMention = Boolean(app.has_mention || app.kind === 'mention' || app.kind === 'both' || app.source === 'mention');
          const isDec = app.kind === 'deceased';

          existing.hasScene = existing.hasScene || isScene;
          existing.hasMention = existing.hasMention || isMention;
          existing.isDeceased = existing.isDeceased || isDec;
          existing.count += (app.count ?? 1);
          if (app.role) existing.role = app.role;

          appearancesMap.set(app.chapter_id, existing);
          appearancesMap.set(cleanId, existing);
          appearancesMap.set(`chapters:${cleanId}`, existing);
        });

        // Determine the index of the last active appearance or death point
        let lastActiveIdx = -1;
        chs.forEach((ch, idx) => {
          const cleanChId = ch.id.replace(/^chapters:/, '');
          const app = appearancesMap.get(ch.id) || appearancesMap.get(cleanChId) || appearancesMap.get(`chapters:${cleanChId}`);
          if (app && (app.hasScene || app.hasMention)) {
            lastActiveIdx = idx;
          }
        });

        chs.forEach((ch, idx) => {
          const cleanChId = ch.id.replace(/^chapters:/, '');
          const app = appearancesMap.get(ch.id) || appearancesMap.get(cleanChId) || appearancesMap.get(`chapters:${cleanChId}`);
          
          if (app && (app.hasScene || app.hasMention)) {
            let status: AppearanceStatus = 'mention';
            let label = 'Упоминание ((Имя))';
            if (app.hasScene && app.hasMention) {
              status = 'both';
              label = 'Сцена и упоминание';
            } else if (app.hasScene) {
              status = 'scene';
              label = 'Сцена / Прямое участие';
            }

            if (app.hasScene) totalScenes++;
            if (app.hasMention) totalMentions++;

            cells.set(ch.id, {
              status,
              hasScene: app.hasScene,
              hasMention: app.hasMention,
              isDeceased: false,
              count: app.count,
              role: app.role,
              label,
            });
            total++;

            if (lastSeenIdx !== -1) {
              const gap = idx - lastSeenIdx - 1;
              if (gap > maxGap) maxGap = gap;
            }
            lastSeenIdx = idx;
          } else if (app?.isDeceased || (isDeceased && (lastActiveIdx === -1 || idx > lastActiveIdx))) {
            cells.set(ch.id, {
              status: 'deceased',
              hasScene: false,
              hasMention: false,
              isDeceased: true,
              count: 0,
              label: 'Погиб',
            });
          } else {
            cells.set(ch.id, {
              status: 'absent',
              hasScene: false,
              hasMention: false,
              isDeceased: false,
              count: 0,
              label: 'Отсутствует',
            });
          }
        });

        const hasGapWarning = filters.value.highlightGaps && maxGap >= 3 && total > 1;

        return {
          entity,
          cells,
          totalAppearances: total,
          totalScenes,
          totalMentions,
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

  const chapterStats = computed(() => {
    const stats = new Map<string, { scenes: number; mentions: number; total: number }>();
    chapters.value.forEach(ch => {
      stats.set(ch.id, { scenes: 0, mentions: 0, total: 0 });
    });
    rows.value.forEach(row => {
      chapters.value.forEach(ch => {
        const cell = row.cells.get(ch.id);
        if (cell) {
          const st = stats.get(ch.id);
          if (st) {
            if (cell.hasScene) st.scenes++;
            if (cell.hasMention) st.mentions++;
            if (cell.hasScene || cell.hasMention) st.total++;
          }
        }
      });
    });
    return stats;
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
    chapterStats,
    totalProjectAppearances,
    isLoading,
    error,
    refresh,
    formatWordCount,
  };
}

import { ref, computed, onMounted } from 'vue';
import { useStoryArcsStore, type StoryArc } from '@/stores/story_arcs.store';
import * as api from '@/services/api.client';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { ArcStatus, ArcType, ArcColumnConfig, ArcBoardFilterState } from './StoryArcs.model';

export const ARC_COLUMNS: ArcColumnConfig[] = [
  { status: 'planned', title: '📋 Запланировано', badgeType: 'muted' },
  { status: 'in_progress', title: '⚡ В Процессе', badgeType: 'accent' },
  { status: 'completed', title: '✅ Завершено', badgeType: 'success' },
  { status: 'abandoned', title: '🛑 Отменено', badgeType: 'danger' },
];

/**
 * Автоматически вычисляет Канбан-статус арки из привязанных блоков/сцен.
 * Если у арки есть привязанные блоки, статус вычисляется по их фазе/состоянию.
 */
export function computeArcKanbanStatus(
  arc: StoryArc,
  allPromises: PlotPromise[]
): ArcStatus {
  if (arc.status === 'abandoned') return 'abandoned';

  const arcId = arc.id || '';
  const cleanArcId = arcId.replace(/^story_arcs:/, '');

  const linked = allPromises.filter(p => {
    if (Array.isArray(p.arcs) && p.arcs.length > 0) {
      return p.arcs.some(a => {
        const aid = String(a.arc_id || '').replace(/^story_arcs:/, '');
        return aid === cleanArcId || aid === arcId;
      });
    }
    if (!p.arc_id) return false;
    const pid = String(p.arc_id).replace(/^story_arcs:/, '');
    return pid === cleanArcId || pid === arcId;
  });

  if (linked.length === 0) {
    return (arc.status as ArcStatus) || 'planned';
  }

  const hasResolved = linked.some(p => {
    let phase = p.arc_phase;
    if (Array.isArray(p.arcs) && p.arcs.length > 0) {
      const entry = p.arcs.find(a => {
        const aid = String(a.arc_id || '').replace(/^story_arcs:/, '');
        return aid === cleanArcId || aid === arcId;
      });
      if (entry?.arc_phase) phase = entry.arc_phase;
    }
    return phase === 'resolution' && (p.status === 'resolved' || p.milestones?.some(m => m.stage === 'resolution'));
  });

  if (hasResolved) return 'completed';

  return 'in_progress';
}

export function useArcBoard(projectId: string) {
  const store = useStoryArcsStore();
  const promises = ref<PlotPromise[]>([]);

  const filters = ref<ArcBoardFilterState>({
    searchQuery: '',
    selectedType: 'all',
  });

  const showCreateModal = ref(false);
  const newArcTitle = ref('');
  const newArcType = ref<ArcType>('character');

  const isLoading = computed(() => store.isLoading);
  const error = computed(() => store.error);

  const loadPromises = async () => {
    if (!projectId) return;
    try {
      const data = await api.getPlotPromises(projectId);
      promises.value = Array.isArray(data) ? (data as unknown as PlotPromise[]) : [];
    } catch {
      promises.value = [];
    }
  };

  const getArcEffectiveStatus = (arc: StoryArc): ArcStatus => {
    return computeArcKanbanStatus(arc, promises.value);
  };

  const getLinkedBlocks = (arcId?: string | null): PlotPromise[] => {
    if (!arcId) return [];
    const cleanArcId = arcId.replace(/^story_arcs:/, '');
    return promises.value.filter(p => {
      if (Array.isArray(p.arcs) && p.arcs.length > 0) {
        return p.arcs.some(a => {
          const aid = String(a.arc_id || '').replace(/^story_arcs:/, '');
          return aid === cleanArcId || aid === arcId;
        });
      }
      if (!p.arc_id) return false;
      const pid = String(p.arc_id).replace(/^story_arcs:/, '');
      return pid === cleanArcId || pid === arcId;
    }).sort((a, b) => {
      const chComp = (a.chapter_id || '').localeCompare(b.chapter_id || '');
      if (chComp !== 0) return chComp;
      return (a.paragraph_index || 0) - (b.paragraph_index || 0);
    });
  };

  const filteredArcs = computed(() => {
    const q = filters.value.searchQuery.toLowerCase().trim();
    return store.arcs.filter((arc: StoryArc) => {
      if (filters.value.selectedType !== 'all' && arc.arc_type !== filters.value.selectedType) {
        return false;
      }
      if (q && !arc.title.toLowerCase().includes(q) && !(arc.description || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  });

  const columns = computed(() => {
    return ARC_COLUMNS.map((col) => ({
      ...col,
      arcs: filteredArcs.value.filter((arc) => getArcEffectiveStatus(arc) === col.status),
    }));
  });

  const createNewArc = async (title: string, arcType: StoryArc['arc_type'] = 'character') => {
    if (!title.trim() || !projectId) return;
    await store.saveArc({
      project_id: projectId,
      title: title.trim(),
      arc_type: arcType,
      status: 'planned',
    });
  };

  const handleCreate = async () => {
    if (!newArcTitle.value.trim()) return;
    await createNewArc(newArcTitle.value, newArcType.value);
    newArcTitle.value = '';
    showCreateModal.value = false;
  };

  const updateArcStatus = async (arc: StoryArc, newStatus: ArcStatus) => {
    await store.saveArc({
      ...arc,
      status: newStatus,
    });
  };

  const deleteArc = async (id?: string | null) => {
    if (!id) return;
    await store.removeArc(id);
  };

  const refresh = async () => {
    if (projectId) {
      await Promise.all([
        store.loadArcs(projectId, true),
        loadPromises(),
      ]);
    }
  };

  onMounted(() => {
    if (projectId) {
      void store.loadArcs(projectId);
      void loadPromises();
    }
  });

  return {
    filters,
    columns,
    promises,
    isLoading,
    error,
    showCreateModal,
    newArcTitle,
    newArcType,
    getArcEffectiveStatus,
    getLinkedBlocks,
    createNewArc,
    handleCreate,
    updateArcStatus,
    deleteArc,
    refresh,
  };
}

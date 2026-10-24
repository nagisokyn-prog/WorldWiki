import { ref, computed, onMounted } from 'vue';
import type { StoryArc } from '@/stores/story_arcs.store';
import type { RichPlotPromise, SceneArcItem } from '@/features/chapters/PromisesPanel/composables/PromiseActions.model';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { plotApi } from '@/services/api/plot.api';
import type {
  ArcStatus,
  ArcType,
  ArcBoardFilterState,
} from './StoryArcs.model';

export function computeArcKanbanStatus(
  arc: StoryArc,
  allPromises: RichPlotPromise[]
): ArcStatus {
  if (arc.status === 'abandoned') return 'abandoned';

  const arcId = arc.id || '';
  const cleanArcId = arcId.replace(/^story_arcs:/, '');

  const linked = allPromises.filter(p => {
    if (Array.isArray(p.arcs) && p.arcs.length > 0) {
      return p.arcs.some((a: SceneArcItem) => {
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
      const entry = p.arcs.find((a: SceneArcItem) => {
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
  const promises = ref<RichPlotPromise[]>([]);

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
      const data = await plotApi.getPlotPromises(projectId);
      promises.value = Array.isArray(data) ? (data as unknown as RichPlotPromise[]) : [];
    } catch (err) {
      console.warn('[useArcBoard] Failed to load plot promises:', err);
      promises.value = [];
    }
  };

  const getArcEffectiveStatus = (arc: StoryArc): ArcStatus => {
    return computeArcKanbanStatus(arc, promises.value);
  };

  const getLinkedBlocks = (arcId?: string | null): RichPlotPromise[] => {
    if (!arcId) return [];
    const cleanArcId = arcId.replace(/^story_arcs:/, '');
    return promises.value.filter(p => {
      if (Array.isArray(p.arcs) && p.arcs.length > 0) {
        return p.arcs.some((a: SceneArcItem) => {
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
      if (q && !arc.title.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  });

  const plannedArcs = computed(() =>
    filteredArcs.value.filter((arc: StoryArc) => getArcEffectiveStatus(arc) === 'planned')
  );

  const inProgressArcs = computed(() =>
    filteredArcs.value.filter((arc: StoryArc) => getArcEffectiveStatus(arc) === 'in_progress')
  );

  const completedArcs = computed(() =>
    filteredArcs.value.filter((arc: StoryArc) => getArcEffectiveStatus(arc) === 'completed')
  );

  const abandonedArcs = computed(() =>
    filteredArcs.value.filter((arc: StoryArc) => getArcEffectiveStatus(arc) === 'abandoned')
  );

  const columns = computed(() => [
    {
      status: 'planned' as ArcStatus,
      title: 'Запланировано',
      badgeType: 'planned',
      arcs: plannedArcs.value,
    },
    {
      status: 'in_progress' as ArcStatus,
      title: 'В процессе',
      badgeType: 'in-progress',
      arcs: inProgressArcs.value,
    },
    {
      status: 'completed' as ArcStatus,
      title: 'Завершено',
      badgeType: 'completed',
      arcs: completedArcs.value,
    },
    {
      status: 'abandoned' as ArcStatus,
      title: 'Отменено',
      badgeType: 'abandoned',
      arcs: abandonedArcs.value,
    },
  ]);

  const updateArcStatus = async (arc: StoryArc, newStatus: ArcStatus) => {
    await store.saveArc({
      ...arc,
      status: newStatus,
    });
  };

  const deleteArc = async (arcId?: string | null) => {
    if (!arcId) return;
    await store.removeArc(arcId);
  };

  const handleCreate = async () => {
    if (!newArcTitle.value.trim()) return;

    await store.saveArc({
      project_id: projectId,
      title: newArcTitle.value.trim(),
      arc_type: newArcType.value,
      status: 'planned',
      color: 'var(--accent-primary)',
    });

    newArcTitle.value = '';
    newArcType.value = 'character';
    showCreateModal.value = false;
  };

  const refresh = async () => {
    await Promise.all([
      store.loadArcs(projectId, true),
      loadPromises(),
    ]);
  };

  onMounted(() => {
    refresh();
  });

  return {
    filters,
    columns,
    isLoading,
    error,
    showCreateModal,
    newArcTitle,
    newArcType,
    getArcEffectiveStatus,
    getLinkedBlocks,
    handleCreate,
    updateArcStatus,
    deleteArc,
    refresh,
  };
}

import { ref, computed, onMounted } from 'vue';
import { useStoryArcsStore, type StoryArc } from '@/stores/story_arcs.store';
import type { ArcStatus, ArcType, ArcColumnConfig, ArcBoardFilterState } from './StoryArcs.model';

export const ARC_COLUMNS: ArcColumnConfig[] = [
  { status: 'planned', title: '📋 Запланировано', badgeType: 'muted' },
  { status: 'in_progress', title: '⚡ В Процессе', badgeType: 'accent' },
  { status: 'completed', title: '✅ Завершено', badgeType: 'success' },
  { status: 'abandoned', title: '🛑 Отменено', badgeType: 'danger' },
];

export function useArcBoard(projectId: string) {
  const store = useStoryArcsStore();

  const filters = ref<ArcBoardFilterState>({
    searchQuery: '',
    selectedType: 'all',
  });

  const showCreateModal = ref(false);
  const newArcTitle = ref('');
  const newArcType = ref<ArcType>('character');

  const isLoading = computed(() => store.isLoading);
  const error = computed(() => store.error);

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
      arcs: filteredArcs.value.filter((arc) => arc.status === col.status),
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
      await store.loadArcs(projectId, true);
    }
  };

  onMounted(() => {
    if (projectId) {
      void store.loadArcs(projectId);
    }
  });

  return {
    filters,
    columns,
    isLoading,
    error,
    showCreateModal,
    newArcTitle,
    newArcType,
    createNewArc,
    handleCreate,
    updateArcStatus,
    deleteArc,
    refresh,
  };
}

// Backwards compatibility alias
export const useStoryArcs = useArcBoard;

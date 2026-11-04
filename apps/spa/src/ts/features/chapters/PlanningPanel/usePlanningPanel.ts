import { ref, computed, watch, nextTick, onMounted, getCurrentInstance } from 'vue';
import * as api from '@/services/api.client';
import { useChapterStore } from '@/stores/chapter.store';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { appAlert } from '@worldwiki/components';
import type { Todo } from '@/types/generated/Todo';
import type {
  PlanningPanelProps,
  PlanningPanelEmitFn,
  TapestryChapterNode,
  TapestryTodo,
  TapestryVolumeBlock,
  DependencyCandidate
} from './PlanningPanel.model';
import {
  getCleanId,
  getQualifiedOwnerId,
  calculateVolumeStats
} from './planningPanel.utils';
import { assembleTapestryVolumeBlocks } from './planningPanelTapestry.utils';
import { createPlanningOutliningActions } from './planningPanelOutlining.utils';
import { usePlanningTodos } from './usePlanningTodos';

export function usePlanningPanel(
  props: PlanningPanelProps,
  emit?: PlanningPanelEmitFn
) {
  const chapterStore = useChapterStore();
  const storyArcsStore = useStoryArcsStore();

  const loading = ref(false);
  const volumeBlocks = ref<TapestryVolumeBlock[]>([]);
  const chaptersList = ref<TapestryChapterNode[]>([]);
  const backlogTodos = ref<TapestryTodo[]>([]);
  const expandedChapters = ref<Set<string>>(new Set());
  const manuallyCollapsedChapters = ref<Set<string>>(new Set());
  const collapsedVolumeIds = ref<Set<string>>(new Set());
  const selectedVolumeIdOverride = ref<string | null>(null);
  const isHelpOpen = ref(false);

  const currentProject = computed(() => props.project || chapterStore.currentChapter?.project_id || 'default');
  const allVolumes = computed(() => chapterStore.hierarchy?.volumes || []);

  const resolvedVolumeId = computed(() => {
    if (selectedVolumeIdOverride.value) return selectedVolumeIdOverride.value;
    if (props.volumeId) return props.volumeId;
    if (chapterStore.selectedVolumeId) return chapterStore.selectedVolumeId;
    if (chapterStore.currentVolume?.id) return chapterStore.currentVolume.id;
    if (chapterStore.hierarchy?.volumes?.[0]?.id) return chapterStore.hierarchy.volumes[0].id;
    const firstChapterWithVolume = (chapterStore.hierarchy?.chapters || chapterStore.chapters || []).find(
      (c) => c.volume_id
    );
    return firstChapterWithVolume?.volume_id || null;
  });

  const currentChapterIdRef = computed(() => props.currentChapterId);

  const volumeTitle = computed(() => {
    if (resolvedVolumeId.value) {
      const cleanTarget = getCleanId(resolvedVolumeId.value);
      const v = (chapterStore.hierarchy?.volumes || []).find((vol) => getCleanId(vol.id) === cleanTarget);
      if (v?.title) return v.title;
    }
    return (
      props.volumeTitle ||
      chapterStore.currentVolume?.title ||
      chapterStore.hierarchy?.volumes?.[0]?.title ||
      'Рукопись тома'
    );
  });

  const allProjectArcs = computed(() =>
    props.arcsList && props.arcsList.length > 0 ? props.arcsList : storyArcsStore.arcs
  );

  const volumeStats = computed(() => calculateVolumeStats(chaptersList.value, backlogTodos.value));

  const totalStats = computed(() => {
    let total = 0, done = 0, inProgress = 0, planned = 0, blocked = 0;
    for (const b of volumeBlocks.value) {
      total += b.stats.total;
      done += b.stats.done;
      inProgress += b.stats.inProgress;
      planned += b.stats.planned;
      blocked += b.stats.blocked;
    }
    return { total, done, inProgress, planned, blocked };
  });

  const allVolumeTodos = computed<DependencyCandidate[]>(() => {
    const result: DependencyCandidate[] = [];
    for (const ch of chaptersList.value) {
      for (const group of ch.arcGroups) {
        for (const t of group.todos) {
          result.push({ id: t.id, text: t.text, chapterId: ch.chapterId, chapterTitle: ch.title, status: t.status });
        }
      }
      for (const t of ch.standaloneTodos) {
        result.push({ id: t.id, text: t.text, chapterId: ch.chapterId, chapterTitle: ch.title, status: t.status });
      }
    }
    return result;
  });

  function handleNavigate(targetChapterId: string) {
    const cleanId = getCleanId(targetChapterId);
    if (!expandedChapters.value.has(cleanId)) expandedChapters.value.add(cleanId);
    emit?.('select-chapter', targetChapterId);
    nextTick(() => {
      const el = document.getElementById(`chapter-card-${cleanId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        el.classList.add('chapter-card-highlight');
        setTimeout(() => el.classList.remove('chapter-card-highlight'), 1800);
      }
    });
  }

  const isVolumeCollapsed = computed(() =>
    resolvedVolumeId.value ? collapsedVolumeIds.value.has(getCleanId(resolvedVolumeId.value)) : false
  );

  const todos = usePlanningTodos(chaptersList, backlogTodos, resolvedVolumeId, currentChapterIdRef, emit);

  const loadTapestryData = async () => {
    loading.value = true;
    try {
      if (!chapterStore.hierarchy?.chapters?.length && currentProject.value) {
        await chapterStore.loadChapters(currentProject.value);
      }
      const allChapters = chapterStore.hierarchy?.chapters || chapterStore.chapters || [];
      const rawVolumes =
        chapterStore.hierarchy?.volumes && chapterStore.hierarchy.volumes.length > 0
          ? chapterStore.hierarchy.volumes
          : [{ id: 'volumes:default', title: 'Основной том' }];

      const currentCleanId = props.currentChapterId ? getCleanId(props.currentChapterId) : null;
      if (
        currentCleanId &&
        !expandedChapters.value.has(currentCleanId) &&
        !manuallyCollapsedChapters.value.has(currentCleanId)
      ) {
        expandedChapters.value.add(currentCleanId);
      }

      const [volBacklogs, chTodos] = await Promise.all([
        Promise.all(
          rawVolumes.map((v) =>
            api.getTodos(getQualifiedOwnerId(getCleanId(v.id), 'volume')).catch(() => [] as Todo[])
          )
        ),
        Promise.all(
          allChapters.map((ch) =>
            api.getTodos(getQualifiedOwnerId(getCleanId(ch.id), 'chapter')).catch(() => [] as Todo[])
          )
        ),
      ]);

      const { blocks, allNodes, allBacklogs } = assembleTapestryVolumeBlocks({
        rawVolumes,
        allChapters,
        volBacklogs,
        chTodos,
        currentCleanId,
        expandedChapters: expandedChapters.value,
        collapsedVolumeIds: collapsedVolumeIds.value,
        allProjectArcs: allProjectArcs.value,
        arcChapters: storyArcsStore.arcChapters,
      });

      volumeBlocks.value = blocks;
      chaptersList.value = allNodes;
      backlogTodos.value = allBacklogs;
    } catch (e) {
      console.error('[usePlanningPanel] Error loading tapestry:', e);
      appAlert('Не удалось загрузить задачи плана');
    } finally {
      loading.value = false;
    }
  };

  const outlining = createPlanningOutliningActions({
    currentProject,
    resolvedVolumeId,
    volumeBlocks,
    chaptersList,
    expandedChapters,
    manuallyCollapsedChapters,
    collapsedVolumeIds,
    loadTapestryData,
    emit,
  });

  function selectVolume(volId: string) {
    selectedVolumeIdOverride.value = volId;
    chapterStore.selectVolume(volId);
    loadTapestryData();
  }

  function toggleHelp() {
    isHelpOpen.value = !isHelpOpen.value;
  }

  async function addBacklogToVolume(volId: string, payload: { ownerId?: string; text: string }) {
    await todos.addBacklog({ ownerId: volId, text: payload.text });
    await loadTapestryData();
  }

  if (getCurrentInstance()) {
    onMounted(() => loadTapestryData());
  }

  watch(
    [
      resolvedVolumeId,
      () => props.currentChapterId,
      () => props.selectedArcFilter,
      () => chapterStore.hierarchy?.chapters?.length,
      () => chapterStore.hierarchy?.volumes?.length,
      () => chapterStore.currentVolume?.id,
    ],
    () => loadTapestryData()
  );

  return {
    loading, volumeBlocks, chaptersList, backlogTodos, allProjectArcs, volumeTitle,
    volumeStats, totalStats, allVolumes, resolvedVolumeId, selectVolume, isVolumeCollapsed,
    addingChapterVolumeId: outlining.addingChapterVolumeId,
    isAddingChapter: outlining.isAddingChapter,
    newChapterTitle: outlining.newChapterTitle,
    chapterInputRef: outlining.chapterInputRef,
    isAddingVolume: outlining.isAddingVolume,
    newVolumeTitle: outlining.newVolumeTitle,
    volumeInputRef: outlining.volumeInputRef,
    isHelpOpen, toggleHelp,
    startAddVolume: outlining.startAddVolume,
    cancelAddVolume: outlining.cancelAddVolume,
    submitAddVolume: outlining.submitAddVolume,
    load: loadTapestryData, loadTapestryData,
    toggleCollapse: outlining.toggleCollapse,
    toggleVolumeCollapse: outlining.toggleVolumeCollapse,
    allVolumeTodos, handleNavigate, setDependency: todos.setDependency,
    toggleTodoStatus: todos.toggleTodoStatus, cycleStatus: todos.cycleStatus,
    setTodoSpecificStatus: todos.setTodoSpecificStatus, saveTodo: todos.saveTodo,
    addTodo: todos.addTodo, addBacklog: todos.addBacklog, addBacklogToVolume,
    deleteTodo: todos.deleteTodo,
    startAddingChapter: outlining.startAddingChapter,
    cancelAddChapter: outlining.cancelAddChapter,
    addPlannedChapter: outlining.addPlannedChapter,
    submitAddChapter: outlining.submitAddChapter,
    moveBacklogToChapter: todos.moveBacklogToChapter,
    attachArc: outlining.attachArc,
  };
}

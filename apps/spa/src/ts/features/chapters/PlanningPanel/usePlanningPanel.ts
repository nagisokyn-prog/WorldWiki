import { ref, computed, watch, nextTick } from 'vue';
import * as api from '@/services/api.client';
import { chapterService } from '@/services/chapter.service';
import { useChapterStore } from '@/stores/chapter.store';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { appAlert } from '@worldwiki/components';
import type { Todo } from '@/types/generated/Todo';
import type {
  PlanningPanelProps,
  PlanningPanelEmitFn,
  TapestryChapterNode,
  TapestryTodo
} from './PlanningPanel.model';
import {
  getCleanId,
  getQualifiedOwnerId,
  mapToTapestryTodo,
  linkCrossChapterCausality,
  buildChapterArcGroups,
  calculateVolumeStats
} from './planningPanel.utils';
import { usePlanningTodos } from './usePlanningTodos';

export function usePlanningPanel(
  props: PlanningPanelProps,
  emit?: PlanningPanelEmitFn
) {
  const chapterStore = useChapterStore();
  const storyArcsStore = useStoryArcsStore();

  const loading = ref(false);
  const chaptersList = ref<TapestryChapterNode[]>([]);
  const backlogTodos = ref<TapestryTodo[]>([]);
  const expandedChapters = ref<Set<string>>(new Set());
  const isVolumeCollapsed = ref(false);

  const currentProject = computed(() => props.project || chapterStore.currentChapter?.project_id || 'default');

  const resolvedVolumeId = computed(() => {
    if (props.volumeId) return props.volumeId;
    if (chapterStore.currentVolume?.id) return chapterStore.currentVolume.id;
    return null;
  });

  const currentChapterIdRef = computed(() => props.currentChapterId);

  const volumeTitle = computed(() => {
    return props.volumeTitle || chapterStore.currentVolume?.title || 'Том рукописи';
  });

  const allProjectArcs = computed(() => {
    return props.arcsList && props.arcsList.length > 0 ? props.arcsList : storyArcsStore.arcs;
  });

  const volumeStats = computed(() => calculateVolumeStats(chaptersList.value, backlogTodos.value));

  const isAddingChapter = ref(false);
  const newChapterTitle = ref('');
  const chapterInputRef = ref<HTMLInputElement | null>(null);

  const todos = usePlanningTodos(
    chaptersList,
    backlogTodos,
    resolvedVolumeId,
    currentChapterIdRef,
    emit
  );

  const loadTapestryData = async () => {
    const volId = resolvedVolumeId.value;
    if (!volId) return;

    loading.value = true;
    try {
      const cleanVolId = getCleanId(volId);
      const allChapters = chapterStore.hierarchy?.chapters || [];
      const volumeChapters = allChapters.filter(c => getCleanId(c.volume_id) === cleanVolId);

      const [backlogRaw, ...chapterTodosResults] = await Promise.all([
        api.getTodos(getQualifiedOwnerId(cleanVolId, 'volume')).catch(() => [] as Todo[]),
        ...volumeChapters.map(ch =>
          api.getTodos(getQualifiedOwnerId(getCleanId(ch.id), 'chapter')).catch(() => [] as Todo[])
        )
      ]);

      backlogTodos.value = (backlogRaw || []).map(mapToTapestryTodo);

      const currentCleanId = props.currentChapterId ? getCleanId(props.currentChapterId) : null;
      if (currentCleanId && !expandedChapters.value.has(currentCleanId)) {
        expandedChapters.value.add(currentCleanId);
      }

      const nodes: TapestryChapterNode[] = [];
      for (let i = 0; i < volumeChapters.length; i++) {
        const ch = volumeChapters[i];
        const cleanChId = getCleanId(ch.id);
        const chTodos = (chapterTodosResults[i] || []).map(mapToTapestryTodo);

        const { arcGroups, standaloneTodos } = buildChapterArcGroups(
          chTodos,
          cleanChId,
          allProjectArcs.value,
          storyArcsStore.arcChapters
        );

        let doneCount = standaloneTodos.filter(t => t.status === 'done' || t.done).length;
        let totalCount = standaloneTodos.length;
        for (const grp of arcGroups) {
          doneCount += grp.todos.filter(t => t.status === 'done' || t.done).length;
          totalCount += grp.todos.length;
        }

        const isCurrent = currentCleanId === cleanChId;
        nodes.push({
          chapterId: ch.id || '',
          title: ch.title || `Глава ${ch.sort_order ?? ''}`,
          sortOrder: typeof ch.sort_order === 'bigint' ? Number(ch.sort_order) : (ch.sort_order ?? 0),
          isCurrent,
          isCollapsed: !expandedChapters.value.has(cleanChId),
          arcGroups,
          standaloneTodos,
          doneCount,
          totalCount
        });
      }

      nodes.sort((a, b) => a.sortOrder - b.sortOrder);
      linkCrossChapterCausality(nodes);
      chaptersList.value = nodes;
    } catch (e) {
      console.error('[usePlanningPanel] Error loading tapestry:', e);
      appAlert('Не удалось загрузить задачи плана');
    } finally {
      loading.value = false;
    }
  };

  function toggleCollapse(chapterId: string) {
    const cleanId = getCleanId(chapterId);
    if (expandedChapters.value.has(cleanId)) {
      expandedChapters.value.delete(cleanId);
    } else {
      expandedChapters.value.add(cleanId);
    }
    const ch = chaptersList.value.find(c => getCleanId(c.chapterId) === cleanId);
    if (ch) {
      ch.isCollapsed = !expandedChapters.value.has(cleanId);
    }
  }

  function toggleVolumeCollapse() {
    isVolumeCollapsed.value = !isVolumeCollapsed.value;
  }

  function startAddingChapter() {
    isAddingChapter.value = true;
    newChapterTitle.value = '';
    nextTick(() => {
      chapterInputRef.value?.focus();
    });
  }

  function cancelAddChapter() {
    isAddingChapter.value = false;
    newChapterTitle.value = '';
  }

  async function submitAddChapter() {
    const title = newChapterTitle.value.trim();
    if (!title) {
      cancelAddChapter();
      return;
    }

    const volId = resolvedVolumeId.value;
    if (!volId) return;

    try {
      const highestOrder = chaptersList.value.reduce((max, c) => Math.max(max, c.sortOrder), 0);
      const nextSortOrder = highestOrder + 1;

      const newCh = chapterService.createNew(title);
      newCh.volume_id = getQualifiedOwnerId(getCleanId(volId), 'volume');
      newCh.sort_order = BigInt(nextSortOrder);

      await chapterService.save(currentProject.value, newCh);

      cancelAddChapter();
      await loadTapestryData();
      emit?.('change');
    } catch (e) {
      appAlert('Не удалось запланировать главу');
      console.error(e);
    }
  }

  async function attachArc(
    payloadOrChapterId: { chapterId: string; arcId: string } | string,
    maybeArcId?: string
  ) {
    const chapterId = typeof payloadOrChapterId === 'string'
      ? payloadOrChapterId
      : payloadOrChapterId.chapterId;
    const arcId = typeof payloadOrChapterId === 'string'
      ? (maybeArcId || '')
      : payloadOrChapterId.arcId;

    try {
      await storyArcsStore.bindChapter({ arc_id: arcId, chapter_id: getCleanId(chapterId) });
      await loadTapestryData();
      emit?.('change');
    } catch (e) {
      appAlert('Не удалось привязать сюжетную арку');
      console.error(e);
    }
  }

  watch([resolvedVolumeId, () => props.currentChapterId, () => props.selectedArcFilter], () => {
    loadTapestryData();
  }, { immediate: true });

  return {
    loading,
    chaptersList,
    backlogTodos,
    allProjectArcs,
    volumeTitle,
    volumeStats,
    resolvedVolumeId,
    isVolumeCollapsed,
    isAddingChapter,
    newChapterTitle,
    chapterInputRef,
    load: loadTapestryData,
    loadTapestryData,
    toggleCollapse,
    toggleVolumeCollapse,
    toggleTodoStatus: todos.toggleTodoStatus,
    cycleStatus: todos.cycleStatus,
    saveTodo: todos.saveTodo,
    addTodo: todos.addTodo,
    deleteTodo: todos.deleteTodo,
    startAddingChapter,
    cancelAddChapter,
    submitAddChapter,
    moveBacklogToChapter: todos.moveBacklogToChapter,
    attachArc
  };
}

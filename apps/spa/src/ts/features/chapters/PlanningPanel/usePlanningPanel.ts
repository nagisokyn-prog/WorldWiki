import { ref, computed, watch, nextTick, onMounted, getCurrentInstance } from 'vue';
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
  const manuallyCollapsedChapters = ref<Set<string>>(new Set());
  const isVolumeCollapsed = ref(false);

  const currentProject = computed(() => props.project || chapterStore.currentChapter?.project_id || 'default');

  const resolvedVolumeId = computed(() => {
    if (props.volumeId) return props.volumeId;
    if (chapterStore.currentVolume?.id) return chapterStore.currentVolume.id;
    return null;
  });

  const currentChapterIdRef = computed(() => props.currentChapterId);

  const volumeTitle = computed(() => {
    return (
      props.volumeTitle ||
      chapterStore.currentVolume?.title ||
      chapterStore.hierarchy?.volumes?.[0]?.title ||
      'Рукопись тома'
    );
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
    loading.value = true;
    try {
      if (!chapterStore.hierarchy?.chapters?.length) {
        await chapterStore.loadChapters(currentProject.value);
      }

      const allChapters = chapterStore.hierarchy?.chapters || chapterStore.chapters || [];
      const resolvedVol =
        resolvedVolumeId.value ||
        chapterStore.currentVolume?.id ||
        chapterStore.hierarchy?.volumes?.[0]?.id ||
        null;

      const cleanVolId = resolvedVol ? getCleanId(resolvedVol) : null;
      let volumeChapters = cleanVolId
        ? allChapters.filter((c) => getCleanId(c.volume_id) === cleanVolId)
        : allChapters;

      if (volumeChapters.length === 0 && allChapters.length > 0) {
        volumeChapters = allChapters;
      }

      const [backlogRaw, ...chapterTodosResults] = await Promise.all([
        cleanVolId
          ? api.getTodos(getQualifiedOwnerId(cleanVolId, 'volume')).catch(() => [] as Todo[])
          : Promise.resolve([] as Todo[]),
        ...volumeChapters.map((ch) =>
          api.getTodos(getQualifiedOwnerId(getCleanId(ch.id), 'chapter')).catch(() => [] as Todo[])
        ),
      ]);

      backlogTodos.value = (backlogRaw || []).map(mapToTapestryTodo);

      const currentCleanId = props.currentChapterId ? getCleanId(props.currentChapterId) : null;
      if (currentCleanId && !expandedChapters.value.has(currentCleanId) && !manuallyCollapsedChapters.value.has(currentCleanId)) {
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
      manuallyCollapsedChapters.value.add(cleanId);
    } else {
      expandedChapters.value.add(cleanId);
      manuallyCollapsedChapters.value.delete(cleanId);
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

  async function addPlannedChapter(titleInput?: string) {
    const title = (typeof titleInput === 'string' ? titleInput : newChapterTitle.value).trim();
    if (!title) {
      cancelAddChapter();
      return;
    }

    const volId = resolvedVolumeId.value || chapterStore.currentVolume?.id || chapterStore.hierarchy?.volumes?.[0]?.id;
    if (!volId) return;

    try {
      const highestOrder = chaptersList.value.reduce((max, c) => Math.max(max, c.sortOrder), 0);
      const nextSortOrder = highestOrder + 1;

      const newCh = chapterService.createNew(title);
      const fullVolId = getQualifiedOwnerId(getCleanId(volId), 'volume');
      newCh.volume_id = fullVolId;
      newCh.sort_order = BigInt(nextSortOrder);

      const saved = await chapterService.save(currentProject.value, newCh);
      const newChId = (typeof saved === 'string' && saved) ? saved : (newCh.id || '');

      await api.assignChapter(currentProject.value, newChId, fullVolId);

      const newNode: TapestryChapterNode = {
        chapterId: newChId,
        title,
        sortOrder: nextSortOrder,
        isCurrent: false,
        isCollapsed: true,
        arcGroups: [],
        standaloneTodos: [],
        doneCount: 0,
        totalCount: 0
      };
      chaptersList.value.push(newNode);

      if (chapterStore.hierarchy?.chapters) {
        chapterStore.hierarchy.chapters.push({
          id: newChId,
          volume_id: fullVolId,
          title,
          sort_order: BigInt(nextSortOrder) as any,
          content: '',
          word_count: 0 as any
        } as any);
      }

      cancelAddChapter();
      emit?.('change');
    } catch (e) {
      console.error('[addPlannedChapter ERROR]:', e);
      appAlert('Не удалось запланировать главу');
    }
  }

  async function submitAddChapter() {
    await addPlannedChapter();
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

  if (getCurrentInstance()) {
    onMounted(() => {
      loadTapestryData();
    });
  }

  watch(
    [
      resolvedVolumeId,
      () => props.currentChapterId,
      () => props.selectedArcFilter,
      () => chapterStore.hierarchy?.chapters?.length,
      () => chapterStore.currentVolume?.id,
    ],
    () => {
      loadTapestryData();
    }
  );

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
    addPlannedChapter,
    submitAddChapter,
    moveBacklogToChapter: todos.moveBacklogToChapter,
    attachArc
  };
}

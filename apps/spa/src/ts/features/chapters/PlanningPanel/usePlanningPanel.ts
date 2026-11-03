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
  TapestryTodo,
  TapestryVolumeBlock,
  DependencyCandidate
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
  const volumeBlocks = ref<TapestryVolumeBlock[]>([]);
  const chaptersList = ref<TapestryChapterNode[]>([]);
  const backlogTodos = ref<TapestryTodo[]>([]);
  const expandedChapters = ref<Set<string>>(new Set());
  const manuallyCollapsedChapters = ref<Set<string>>(new Set());
  const collapsedVolumeIds = ref<Set<string>>(new Set());
  const selectedVolumeIdOverride = ref<string | null>(null);

  const addingChapterVolumeId = ref<string | null>(null);
  const newChapterTitle = ref('');
  const chapterInputRef = ref<HTMLInputElement | null>(null);

  const isAddingVolume = ref(false);
  const newVolumeTitle = ref('');
  const volumeInputRef = ref<HTMLInputElement | null>(null);

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
    if (firstChapterWithVolume?.volume_id) return firstChapterWithVolume.volume_id;
    return null;
  });

  const currentChapterIdRef = computed(() => props.currentChapterId);

  const volumeTitle = computed(() => {
    if (resolvedVolumeId.value) {
      const cleanTarget = getCleanId(resolvedVolumeId.value);
      const v = (chapterStore.hierarchy?.volumes || []).find(
        (vol) => getCleanId(vol.id) === cleanTarget
      );
      if (v?.title) return v.title;
    }
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

  const totalStats = computed(() => {
    let total = 0;
    let done = 0;
    let inProgress = 0;
    let planned = 0;
    let blocked = 0;
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
          result.push({
            id: t.id,
            text: t.text,
            chapterId: ch.chapterId,
            chapterTitle: ch.title,
            status: t.status
          });
        }
      }
      for (const t of ch.standaloneTodos) {
        result.push({
          id: t.id,
          text: t.text,
          chapterId: ch.chapterId,
          chapterTitle: ch.title,
          status: t.status
        });
      }
    }
    return result;
  });

  function handleNavigate(targetChapterId: string) {
    const cleanId = getCleanId(targetChapterId);
    if (!expandedChapters.value.has(cleanId)) {
      expandedChapters.value.add(cleanId);
    }
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

  const isVolumeCollapsed = computed(() => {
    if (!resolvedVolumeId.value) return false;
    return collapsedVolumeIds.value.has(getCleanId(resolvedVolumeId.value));
  });

  const isAddingChapter = computed(() => addingChapterVolumeId.value !== null);

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
      if (!chapterStore.hierarchy?.chapters?.length && currentProject.value) {
        await chapterStore.loadChapters(currentProject.value);
      }

      const allChapters = chapterStore.hierarchy?.chapters || chapterStore.chapters || [];
      const rawVolumes = chapterStore.hierarchy?.volumes && chapterStore.hierarchy.volumes.length > 0
        ? chapterStore.hierarchy.volumes
        : [{ id: 'volumes:default', title: 'Основной том' }];

      const currentCleanId = props.currentChapterId ? getCleanId(props.currentChapterId) : null;
      if (currentCleanId && !expandedChapters.value.has(currentCleanId) && !manuallyCollapsedChapters.value.has(currentCleanId)) {
        expandedChapters.value.add(currentCleanId);
      }

      const volBacklogPromises = rawVolumes.map((v) => {
        const cleanVId = getCleanId(v.id);
        return api.getTodos(getQualifiedOwnerId(cleanVId, 'volume')).catch(() => [] as Todo[]);
      });

      const chTodosPromises = allChapters.map((ch) => {
        const cleanChId = getCleanId(ch.id);
        return api.getTodos(getQualifiedOwnerId(cleanChId, 'chapter')).catch(() => [] as Todo[]);
      });

      const [volBacklogs, chTodos] = await Promise.all([
        Promise.all(volBacklogPromises),
        Promise.all(chTodosPromises),
      ]);

      const chTodosMap = new Map<string, TapestryTodo[]>();
      allChapters.forEach((ch, idx) => {
        const cleanChId = getCleanId(ch.id);
        chTodosMap.set(cleanChId, (chTodos[idx] || []).map(mapToTapestryTodo));
      });

      const blocks: TapestryVolumeBlock[] = [];
      const assignedChapterIds = new Set<string>();

      rawVolumes.forEach((vol, vIdx) => {
        const rawVolId = vol.id || `volumes:vol_${vIdx}`;
        const cleanVolId = getCleanId(rawVolId);
        const volTitle = vol.title || `Том ${vIdx + 1}`;
        const volBacklog = (volBacklogs[vIdx] || []).map(mapToTapestryTodo);

        const matchingChapters = allChapters.filter((c) => {
          if (!c.volume_id && vIdx === 0) return true;
          return getCleanId(c.volume_id) === cleanVolId;
        });

        matchingChapters.forEach((c) => assignedChapterIds.add(getCleanId(c.id)));

        const chapterNodes: TapestryChapterNode[] = matchingChapters.map((ch) => {
          const cleanChId = getCleanId(ch.id);
          const rawTodos = chTodosMap.get(cleanChId) || [];
          const { arcGroups, standaloneTodos } = buildChapterArcGroups(
            rawTodos,
            cleanChId,
            allProjectArcs.value,
            storyArcsStore.arcChapters
          );

          let doneCount = standaloneTodos.filter((t) => t.status === 'done' || t.done).length;
          let totalCount = standaloneTodos.length;
          for (const grp of arcGroups) {
            doneCount += grp.todos.filter((t) => t.status === 'done' || t.done).length;
            totalCount += grp.todos.length;
          }

          return {
            chapterId: ch.id || '',
            title: ch.title || `Глава ${ch.sort_order ?? ''}`,
            sortOrder: typeof ch.sort_order === 'bigint' ? Number(ch.sort_order) : (ch.sort_order ?? 0),
            isCurrent: currentCleanId === cleanChId,
            isCollapsed: !expandedChapters.value.has(cleanChId),
            arcGroups,
            standaloneTodos,
            doneCount,
            totalCount
          };
        });

        chapterNodes.sort((a, b) => a.sortOrder - b.sortOrder);

        const stats = calculateVolumeStats(chapterNodes, volBacklog);
        const chapterOptions = chapterNodes.map((c) => ({
          chapterId: c.chapterId,
          title: c.title
        }));

        blocks.push({
          volumeId: rawVolId,
          cleanVolumeId: cleanVolId,
          title: volTitle,
          isCollapsed: collapsedVolumeIds.value.has(cleanVolId),
          stats,
          chapters: chapterNodes,
          chapterOptions,
          backlogTodos: volBacklog
        });
      });

      // Handle unassigned chapters in extra block if needed
      const remainingChapters = allChapters.filter(c => !assignedChapterIds.has(getCleanId(c.id)));
      if (remainingChapters.length > 0 && rawVolumes.length > 0) {
        const firstBlock = blocks[0];
        const extraNodes = remainingChapters.map((ch) => {
          const cleanChId = getCleanId(ch.id);
          const rawTodos = chTodosMap.get(cleanChId) || [];
          const { arcGroups, standaloneTodos } = buildChapterArcGroups(
            rawTodos,
            cleanChId,
            allProjectArcs.value,
            storyArcsStore.arcChapters
          );
          let doneCount = standaloneTodos.filter((t) => t.status === 'done' || t.done).length;
          let totalCount = standaloneTodos.length;
          for (const grp of arcGroups) {
            doneCount += grp.todos.filter((t) => t.status === 'done' || t.done).length;
            totalCount += grp.todos.length;
          }
          return {
            chapterId: ch.id || '',
            title: ch.title || `Глава ${ch.sort_order ?? ''}`,
            sortOrder: typeof ch.sort_order === 'bigint' ? Number(ch.sort_order) : (ch.sort_order ?? 0),
            isCurrent: currentCleanId === cleanChId,
            isCollapsed: !expandedChapters.value.has(cleanChId),
            arcGroups,
            standaloneTodos,
            doneCount,
            totalCount
          };
        });
        firstBlock.chapters.push(...extraNodes);
        firstBlock.chapters.sort((a, b) => a.sortOrder - b.sortOrder);
        firstBlock.stats = calculateVolumeStats(firstBlock.chapters, firstBlock.backlogTodos);
        firstBlock.chapterOptions = firstBlock.chapters.map(c => ({ chapterId: c.chapterId, title: c.title }));
      }

      const allNodes = blocks.flatMap((b) => b.chapters);
      linkCrossChapterCausality(allNodes);

      volumeBlocks.value = blocks;
      chaptersList.value = allNodes;
      backlogTodos.value = blocks.flatMap((b) => b.backlogTodos);
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

    for (const block of volumeBlocks.value) {
      const ch = block.chapters.find((c) => getCleanId(c.chapterId) === cleanId);
      if (ch) {
        ch.isCollapsed = !expandedChapters.value.has(cleanId);
      }
    }
    const flatCh = chaptersList.value.find((c) => getCleanId(c.chapterId) === cleanId);
    if (flatCh) {
      flatCh.isCollapsed = !expandedChapters.value.has(cleanId);
    }
  }

  function toggleVolumeCollapse(volId?: string) {
    const targetVol = volId || resolvedVolumeId.value || volumeBlocks.value[0]?.volumeId;
    if (!targetVol) return;
    const cleanVol = getCleanId(targetVol);
    if (collapsedVolumeIds.value.has(cleanVol)) {
      collapsedVolumeIds.value.delete(cleanVol);
    } else {
      collapsedVolumeIds.value.add(cleanVol);
    }

    const block = volumeBlocks.value.find((b) => b.cleanVolumeId === cleanVol);
    if (block) {
      block.isCollapsed = collapsedVolumeIds.value.has(cleanVol);
    }
  }

  function startAddingChapter(volId?: string) {
    addingChapterVolumeId.value = volId || resolvedVolumeId.value || volumeBlocks.value[0]?.volumeId || null;
    newChapterTitle.value = '';
    nextTick(() => {
      chapterInputRef.value?.focus();
    });
  }

  function cancelAddChapter() {
    addingChapterVolumeId.value = null;
    newChapterTitle.value = '';
  }

  async function addPlannedChapter(volIdOrTitle?: string, titleInput?: string) {
    let targetVolId: string | undefined;
    let title: string;

    if (titleInput !== undefined) {
      targetVolId = volIdOrTitle;
      title = titleInput.trim();
    } else if (
      volIdOrTitle &&
      !newChapterTitle.value.trim() &&
      !volumeBlocks.value.some(b => b.volumeId === volIdOrTitle || b.cleanVolumeId === getCleanId(volIdOrTitle))
    ) {
      // Called directly with title as first argument (e.g. in unit tests or programmatic invocation)
      title = volIdOrTitle.trim();
      targetVolId = addingChapterVolumeId.value || resolvedVolumeId.value || chapterStore.hierarchy?.volumes?.[0]?.id || 'volumes:vol_1';
    } else {
      targetVolId = volIdOrTitle || addingChapterVolumeId.value || resolvedVolumeId.value || chapterStore.hierarchy?.volumes?.[0]?.id || 'volumes:vol_1';
      title = (newChapterTitle.value || volIdOrTitle || '').trim();
    }

    if (!title) {
      cancelAddChapter();
      return;
    }

    if (!targetVolId) return;

    try {
      const cleanVolId = getCleanId(targetVolId);
      const targetBlock = volumeBlocks.value.find(b => b.cleanVolumeId === cleanVolId);
      const chsInVol = targetBlock ? targetBlock.chapters : chaptersList.value;
      const highestOrder = chsInVol.reduce((max, c) => Math.max(max, c.sortOrder), 0);
      const nextSortOrder = highestOrder + 1;

      const newCh = chapterService.createNew(title);
      const fullVolId = getQualifiedOwnerId(cleanVolId, 'volume');
      newCh.volume_id = fullVolId;
      newCh.sort_order = nextSortOrder as unknown as bigint;

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

      if (targetBlock) {
        targetBlock.chapters.push(newNode);
        targetBlock.stats = calculateVolumeStats(targetBlock.chapters, targetBlock.backlogTodos);
        targetBlock.chapterOptions = targetBlock.chapters.map(c => ({ chapterId: c.chapterId, title: c.title }));
      }
      chaptersList.value.push(newNode);

      if (chapterStore.hierarchy?.chapters) {
        chapterStore.hierarchy.chapters.push({
          id: newChId,
          volume_id: fullVolId,
          title,
          sort_order: nextSortOrder as any,
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

  async function submitAddChapter(volId?: string) {
    await addPlannedChapter(volId);
  }

  function startAddVolume() {
    isAddingVolume.value = true;
    newVolumeTitle.value = '';
    nextTick(() => {
      volumeInputRef.value?.focus();
    });
  }

  function cancelAddVolume() {
    isAddingVolume.value = false;
    newVolumeTitle.value = '';
  }

  async function submitAddVolume() {
    const title = newVolumeTitle.value.trim();
    if (!title) {
      cancelAddVolume();
      return;
    }
    try {
      await api.createVolume(currentProject.value, title);
      await chapterStore.loadChapters(currentProject.value);
      cancelAddVolume();
      await loadTapestryData();
      emit?.('change');
    } catch (e) {
      console.error('[submitAddVolume ERROR]:', e);
      appAlert('Не удалось создать новый том');
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

  function selectVolume(volId: string) {
    selectedVolumeIdOverride.value = volId;
    chapterStore.selectVolume(volId);
    loadTapestryData();
  }

  function toggleHelp() {
    isHelpOpen.value = !isHelpOpen.value;
  }

  async function addBacklogToVolume(volId: string, payload: { ownerId?: string; text: string }) {
    await todos.addBacklog({
      ownerId: volId,
      text: payload.text
    });
    await loadTapestryData();
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
      () => chapterStore.hierarchy?.volumes?.length,
      () => chapterStore.currentVolume?.id,
    ],
    () => {
      loadTapestryData();
    }
  );

  return {
    loading,
    volumeBlocks,
    chaptersList,
    backlogTodos,
    allProjectArcs,
    volumeTitle,
    volumeStats,
    totalStats,
    allVolumes,
    resolvedVolumeId,
    selectVolume,
    isVolumeCollapsed,
    addingChapterVolumeId,
    isAddingChapter,
    newChapterTitle,
    chapterInputRef,
    isAddingVolume,
    newVolumeTitle,
    volumeInputRef,
    isHelpOpen,
    toggleHelp,
    startAddVolume,
    cancelAddVolume,
    submitAddVolume,
    load: loadTapestryData,
    loadTapestryData,
    toggleCollapse,
    toggleVolumeCollapse,
    allVolumeTodos,
    handleNavigate,
    setDependency: todos.setDependency,
    toggleTodoStatus: todos.toggleTodoStatus,
    cycleStatus: todos.cycleStatus,
    setTodoSpecificStatus: todos.setTodoSpecificStatus,
    saveTodo: todos.saveTodo,
    addTodo: todos.addTodo,
    addBacklog: todos.addBacklog,
    addBacklogToVolume,
    deleteTodo: todos.deleteTodo,
    startAddingChapter,
    cancelAddChapter,
    addPlannedChapter,
    submitAddChapter,
    moveBacklogToChapter: todos.moveBacklogToChapter,
    attachArc
  };
}

import { ref, computed, watch, nextTick } from 'vue';
import * as api from '@/services/api.client';
import { chapterService } from '@/services/chapter.service';
import { useChapterStore } from '@/stores/chapter.store';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { appAlert } from '@worldwiki/components';
import type { Todo } from '@/types/generated/Todo';
import type {
  PlanningPanelProps,
  TapestryChapterNode,
  TapestryArcGroup,
  TapestryTodo,
  TodoStatus
} from './PlanningPanel.model';

export function usePlanningPanel(
  props: PlanningPanelProps,
  emit?: (event: string, ...args: unknown[]) => void
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

  const volumeTitle = computed(() => {
    if (props.volumeTitle) return props.volumeTitle;
    if (chapterStore.currentVolume?.title) return chapterStore.currentVolume.title;
    return 'Рукопись тома';
  });

  const allProjectArcs = computed(() => storyArcsStore.arcs || []);

  const volumeStats = computed(() => {
    let total = backlogTodos.value.length;
    let done = backlogTodos.value.filter(t => t.status === 'done' || t.done).length;
    let inProgress = backlogTodos.value.filter(t => t.status === 'in_progress').length;
    let planned = backlogTodos.value.filter(t => t.status === 'planned').length;
    let blocked = backlogTodos.value.filter(t => t.status === 'blocked').length;

    for (const ch of chaptersList.value) {
      total += ch.totalCount;
      done += ch.doneCount;
      for (const grp of ch.arcGroups) {
        inProgress += grp.todos.filter(t => t.status === 'in_progress').length;
        planned += grp.todos.filter(t => t.status === 'planned').length;
        blocked += grp.todos.filter(t => t.status === 'blocked').length;
      }
      inProgress += ch.standaloneTodos.filter(t => t.status === 'in_progress').length;
      planned += ch.standaloneTodos.filter(t => t.status === 'planned').length;
      blocked += ch.standaloneTodos.filter(t => t.status === 'blocked').length;
    }

    return { total, done, inProgress, planned, blocked };
  });

  function getCleanId(id?: string | null): string {
    if (!id) return '';
    return id.replace(/^(chapters|volumes|story_arcs|todos):/, '');
  }

  function getQualifiedOwnerId(id?: string | null, type: 'chapter' | 'volume' = 'chapter'): string {
    const raw = (id || '').trim();
    if (!raw) return '';
    if (raw.includes(':')) return raw;
    return type === 'volume' ? `volumes:${raw}` : `chapters:${raw}`;
  }

  function getPhaseLabel(phase?: string | null): string {
    switch (phase) {
      case 'setup': return '🌱 Завязка';
      case 'escalation': return '⚡ Эскалация';
      case 'climax': return '🔥 Кульминация';
      case 'resolution': return '✅ Развязка';
      default: return '🌱 Развитие';
    }
  }

  // ─── Load & Build Narrative Tapestry ─────────────────────
  const load = async () => {
    loading.value = true;
    try {
      if (currentProject.value) {
        await storyArcsStore.loadArcs(currentProject.value);
      }

      const volId = resolvedVolumeId.value;
      const cleanCurChId = getCleanId(props.currentChapterId || chapterStore.currentChapterId);
      if (cleanCurChId && expandedChapters.value.size === 0) {
        expandedChapters.value.add(cleanCurChId);
      }

      // 1. Determine chapters in scope
      const allHierarchyChapters = chapterStore.hierarchy?.chapters || [];
      const scopedChapters = volId
        ? allHierarchyChapters.filter(c => getCleanId(c.volume_id) === getCleanId(volId))
        : allHierarchyChapters;

      const chaptersToLoad = scopedChapters.length > 0
        ? scopedChapters
        : (chapterStore.currentChapter ? [chapterStore.currentChapter] : []);

      // 2. Fetch todos for all chapters in parallel
      const chapterTodosMap = new Map<string, Todo[]>();
      await Promise.all(
        chaptersToLoad.map(async (ch) => {
          if (!ch.id) return;
          const ownerId = getQualifiedOwnerId(ch.id, 'chapter');
          try {
            const rawTodos = await api.getTodos(ownerId);
            chapterTodosMap.set(getCleanId(ch.id), rawTodos || []);
          } catch {
            chapterTodosMap.set(getCleanId(ch.id), []);
          }
        })
      );

      // 3. Fetch volume backlog todos
      if (volId) {
        try {
          const rawBacklog = await api.getTodos(getQualifiedOwnerId(volId, 'volume'));
          backlogTodos.value = (rawBacklog || []).map(t => mapToTapestryTodo(t));
        } catch {
          backlogTodos.value = [];
        }
      } else {
        backlogTodos.value = [];
      }

      // 4. Map chapters into TapestryChapterNode
      const nodes: TapestryChapterNode[] = [];

      for (const ch of chaptersToLoad) {
        if (!ch.id) continue;
        const cleanChId = getCleanId(ch.id);
        const isCurrent = cleanChId === cleanCurChId;
        const rawTodos = chapterTodosMap.get(cleanChId) || [];

        // Determine bound arcs for this chapter from storyArcsStore
        const boundArcsForChapter = storyArcsStore.arcs.filter(arc => {
          if (!arc.id) return false;
          const relations = storyArcsStore.arcChapters.get(arc.id) || [];
          return relations.some(r => {
            const outCandidate = r.chapter_id || r.out;
            return outCandidate && getCleanId(outCandidate) === cleanChId;
          });
        });

        // Map todos
        const tapestryTodos = rawTodos.map(t => mapToTapestryTodo(t));

        // Group by arcs
        const arcGroups: TapestryArcGroup[] = [];
        const assignedTodoIds = new Set<string>();

        // First, add groups for explicitly bound arcs
        for (const arc of boundArcsForChapter) {
          if (!arc.id) continue;
          const cleanArcId = getCleanId(arc.id);
          const arcTodos = tapestryTodos.filter(t => t.arc_id && getCleanId(t.arc_id) === cleanArcId);
          arcTodos.forEach(t => assignedTodoIds.add(t.id));

          const relations = storyArcsStore.arcChapters.get(arc.id) || [];
          const rel = relations.find(r => (r.chapter_id || r.out) && getCleanId(r.chapter_id || r.out) === cleanChId);

          arcGroups.push({
            arcId: arc.id,
            title: arc.title,
            color: arc.color,
            phase: rel?.phase || null,
            phaseLabel: getPhaseLabel(rel?.phase),
            todos: arcTodos
          });
        }

        // Second, if any todo has an arc_id not yet grouped, add a group for it
        for (const t of tapestryTodos) {
          if (t.arc_id && !assignedTodoIds.has(t.id)) {
            const cleanArcId = getCleanId(t.arc_id);
            const foundArc = storyArcsStore.arcs.find(a => a.id && getCleanId(a.id) === cleanArcId);
            const existingGroup = arcGroups.find(g => getCleanId(g.arcId) === cleanArcId);
            if (existingGroup) {
              existingGroup.todos.push(t);
            } else {
              arcGroups.push({
                arcId: t.arc_id,
                title: foundArc?.title || t.arc_title || 'Сюжетная линия',
                color: foundArc?.color || t.arc_color || null,
                phase: null,
                phaseLabel: '🌱 Развитие',
                todos: [t]
              });
            }
            assignedTodoIds.add(t.id);
          }
        }

        // Remaining are standalone editorial / text tasks
        const standaloneTodos = tapestryTodos.filter(t => !assignedTodoIds.has(t.id));

        const totalCount = tapestryTodos.length;
        const doneCount = tapestryTodos.filter(t => t.status === 'done' || t.done).length;

        nodes.push({
          chapterId: ch.id,
          title: ch.title || 'Без названия',
          sortOrder: typeof ch.sort_order === 'bigint' ? Number(ch.sort_order) : Number(ch.sort_order || 0),
          isCurrent,
          isCollapsed: !expandedChapters.value.has(cleanChId),
          arcGroups,
          standaloneTodos,
          doneCount,
          totalCount
        });
      }

      // Sort by sort_order
      nodes.sort((a, b) => a.sortOrder - b.sortOrder);

      // 5. Build cross-chapter causality relationships (depends_on / blocks)
      const allTapestryTodos: TapestryTodo[] = [];
      const todoChapterMap = new Map<string, string>();
      for (const n of nodes) {
        for (const g of n.arcGroups) {
          for (const t of g.todos) {
            allTapestryTodos.push(t);
            todoChapterMap.set(getCleanId(t.id), n.title);
          }
        }
        for (const t of n.standaloneTodos) {
          allTapestryTodos.push(t);
          todoChapterMap.set(getCleanId(t.id), n.title);
        }
      }

      for (const t of allTapestryTodos) {
        if (t.depends_on) {
          const parentCleanId = getCleanId(t.depends_on);
          const parentTodo = allTapestryTodos.find(p => getCleanId(p.id) === parentCleanId);
          if (parentTodo) {
            const parentChTitle = todoChapterMap.get(parentCleanId);
            t.depends_on_title = parentChTitle ? `[${parentChTitle}] ${parentTodo.text}` : parentTodo.text;
            parentTodo.blocks_title = todoChapterMap.get(getCleanId(t.id));
            parentTodo.blocks_chapter_id = t.owner_id;
          }
        }
      }

      chaptersList.value = nodes;
    } catch (e) {
      console.error('[usePlanningPanel] Error loading tapestry:', e);
      appAlert('Не удалось загрузить задачи плана');
    } finally {
      loading.value = false;
    }
  };

  function mapToTapestryTodo(raw: Todo): TapestryTodo {
    const rawStatus = (raw.status as unknown as string) || (raw.is_done ? 'done' : 'planned');
    const validStatus: TodoStatus = (rawStatus === 'done' || rawStatus === 'in_progress' || rawStatus === 'blocked')
      ? rawStatus
      : 'planned';

    return {
      id: raw.id || '',
      text: raw.text,
      status: validStatus,
      done: validStatus === 'done' || raw.is_done,
      owner_id: raw.owner_id,
      sort_order: raw.sort_order || 0,
      arc_id: raw.arc_id || null,
      arc_title: raw.arc_title || null,
      arc_color: null,
      depends_on: raw.depends_on || null,
      depends_on_title: null,
      blocks_title: null,
      blocks_chapter_id: null
    };
  }

  // ─── Collapse / Expand Chapter Card & Volume ─────────────
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

  // ─── Status Transitions ──────────────────────────────────
  async function toggleTodoStatus(todo: TapestryTodo) {
    const transitions: Record<TodoStatus, TodoStatus> = {
      planned: 'in_progress',
      in_progress: 'done',
      done: 'planned',
      blocked: 'planned'
    };
    const nextStatus = transitions[todo.status] || 'planned';
    await applyStatus(todo, nextStatus);
  }

  async function cycleStatus(todo: TapestryTodo) {
    const contextCycle: Record<TodoStatus, TodoStatus> = {
      planned: 'in_progress',
      in_progress: 'done',
      done: 'blocked',
      blocked: 'planned'
    };
    const nextStatus = contextCycle[todo.status] || 'planned';
    await applyStatus(todo, nextStatus);
  }

  async function applyStatus(todo: TapestryTodo, nextStatus: TodoStatus) {
    const oldStatus = todo.status;
    const oldDone = todo.done;
    todo.status = nextStatus;
    todo.done = nextStatus === 'done';

    try {
      await api.setTodoStatus(todo.id, nextStatus);

      // Cascade unblock in memory if done
      if (nextStatus === 'done') {
        const cleanParentId = getCleanId(todo.id);
        for (const ch of chaptersList.value) {
          for (const grp of ch.arcGroups) {
            for (const item of grp.todos) {
              if (item.depends_on && getCleanId(item.depends_on) === cleanParentId && item.status === 'blocked') {
                item.status = 'planned';
              }
            }
          }
          for (const item of ch.standaloneTodos) {
            if (item.depends_on && getCleanId(item.depends_on) === cleanParentId && item.status === 'blocked') {
              item.status = 'planned';
            }
          }
        }
      }

      emit?.('change');
    } catch (e) {
      todo.status = oldStatus;
      todo.done = oldDone;
      appAlert('Не удалось обновить статус задачи');
      console.error(e);
    }
  }

  // ─── Save / Update Text ──────────────────────────────────
  async function saveTodo(todo: TapestryTodo) {
    const text = todo.text.trim();
    if (!text) return;
    try {
      await api.createTodo(
        todo.owner_id,
        text,
        todo.sort_order,
        todo.arc_id || null,
        todo.depends_on || null
      );
      emit?.('change');
    } catch (e) {
      appAlert('Ошибка при сохранении задачи');
      console.error(e);
    }
  }

  // ─── Add Todo ────────────────────────────────────────────
  async function addTodo(payload: { ownerId: string; text: string; arcId?: string | null; dependsOn?: string | null }) {
    const ownerId = getQualifiedOwnerId(payload.ownerId, payload.ownerId.includes('volumes:') ? 'volume' : 'chapter');
    try {
      const createdId = await api.createTodo(
        ownerId,
        payload.text,
        Date.now(),
        payload.arcId || null,
        payload.dependsOn || null
      );

      const newTodo: TapestryTodo = {
        id: createdId,
        text: payload.text,
        status: 'planned',
        done: false,
        owner_id: ownerId,
        sort_order: Date.now(),
        arc_id: payload.arcId || null,
        arc_title: payload.arcId ? storyArcsStore.arcs.find(a => a.id === payload.arcId)?.title || null : null,
        arc_color: null,
        depends_on: payload.dependsOn || null,
        depends_on_title: null,
        blocks_title: null,
        blocks_chapter_id: null
      };

      const cleanOwnerId = getCleanId(payload.ownerId);
      const targetCh = chaptersList.value.find(c => getCleanId(c.chapterId) === cleanOwnerId);

      if (targetCh) {
        if (payload.arcId) {
          const group = targetCh.arcGroups.find(g => getCleanId(g.arcId) === getCleanId(payload.arcId));
          if (group) {
            group.todos.push(newTodo);
          } else {
            targetCh.arcGroups.push({
              arcId: payload.arcId,
              title: newTodo.arc_title || 'Сюжетная линия',
              color: null,
              phase: null,
              phaseLabel: '🌱 Развитие',
              todos: [newTodo]
            });
          }
        } else {
          targetCh.standaloneTodos.push(newTodo);
        }
        targetCh.totalCount++;
      } else if (payload.ownerId.includes('volumes:') || (resolvedVolumeId.value && getCleanId(payload.ownerId) === getCleanId(resolvedVolumeId.value))) {
        backlogTodos.value.push(newTodo);
      }

      emit?.('change');
    } catch (e) {
      appAlert('Не удалось добавить задачу');
      console.error(e);
    }
  }

  // ─── Delete Todo ─────────────────────────────────────────
  async function deleteTodo(todo: TapestryTodo) {
    try {
      await api.deleteTodo(todo.id);

      // Remove from memory
      for (const ch of chaptersList.value) {
        for (const grp of ch.arcGroups) {
          const idx = grp.todos.findIndex(t => t.id === todo.id);
          if (idx !== -1) {
            grp.todos.splice(idx, 1);
            ch.totalCount = Math.max(0, ch.totalCount - 1);
            if (todo.status === 'done' || todo.done) {
              ch.doneCount = Math.max(0, ch.doneCount - 1);
            }
            emit?.('change');
            return;
          }
        }
        const stIdx = ch.standaloneTodos.findIndex(t => t.id === todo.id);
        if (stIdx !== -1) {
          ch.standaloneTodos.splice(stIdx, 1);
          ch.totalCount = Math.max(0, ch.totalCount - 1);
          if (todo.status === 'done' || todo.done) {
            ch.doneCount = Math.max(0, ch.doneCount - 1);
          }
          emit?.('change');
          return;
        }
      }

      // Check backlog
      const bIdx = backlogTodos.value.findIndex(t => t.id === todo.id);
      if (bIdx !== -1) {
        backlogTodos.value.splice(bIdx, 1);
        emit?.('change');
      }
    } catch (e) {
      appAlert('Не удалось удалить задачу');
      console.error(e);
    }
  }

  // ─── Outlining: Create Planned Chapter in Tree ───────────
  async function addPlannedChapter(title: string) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const project = currentProject.value;
    const volId = resolvedVolumeId.value;

    try {
      // Create new chapter using chapterService
      const newCh = chapterService.createNew(trimmedTitle);
      if (volId) {
        newCh.volume_id = volId;
      }

      const savedId = await chapterService.save(project, newCh);

      if (volId && savedId) {
        await api.assignChapter(project, savedId, volId);
      }

      // Reload hierarchy so left tree updates
      await chapterStore.loadHierarchy(project);

      // Append new chapter to plan list
      chaptersList.value.push({
        chapterId: savedId,
        title: trimmedTitle,
        sortOrder: chaptersList.value.length + 1,
        isCurrent: false,
        isCollapsed: false,
        arcGroups: [],
        standaloneTodos: [],
        doneCount: 0,
        totalCount: 0
      });

      emit?.('change');
    } catch (e) {
      appAlert('Не удалось запланировать главу');
      console.error(e);
    }
  }

  // ─── Move Backlog Item to Current Chapter ────────────────
  async function moveBacklogToChapter(todoId: string) {
    const curChId = props.currentChapterId || chapterStore.currentChapterId;
    if (!curChId) {
      appAlert('Сначала откройте главу, в которую хотите перенести задачу');
      return;
    }

    const todoIdx = backlogTodos.value.findIndex(t => t.id === todoId);
    if (todoIdx === -1) return;
    const todo = backlogTodos.value[todoIdx];

    const targetOwnerId = getQualifiedOwnerId(curChId, 'chapter');

    try {
      // Re-save with new owner
      const newId = await api.createTodo(
        targetOwnerId,
        todo.text,
        Date.now(),
        todo.arc_id || null,
        todo.depends_on || null
      );
      await api.deleteTodo(todo.id);

      backlogTodos.value.splice(todoIdx, 1);

      todo.id = newId;
      todo.owner_id = targetOwnerId;

      const cleanChId = getCleanId(curChId);
      const ch = chaptersList.value.find(c => getCleanId(c.chapterId) === cleanChId);
      if (ch) {
        ch.standaloneTodos.push(todo);
        ch.totalCount++;
      }

      emit?.('change');
    } catch (e) {
      appAlert('Не удалось перенести задачу в главу');
      console.error(e);
    }
  }

  // ─── Attach Arc to Chapter ───────────────────────────────
  async function attachArc(payload: { chapterId: string; arcId: string }) {
    const project = currentProject.value;
    try {
      await storyArcsStore.bindChapter({ arc_id: payload.arcId, chapter_id: payload.chapterId });
      await storyArcsStore.loadArcs(project, true);
      await load();
      emit?.('select-arc', payload.arcId);
    } catch (e) {
      appAlert('Не удалось привязать сюжетную арку к главе');
      console.error(e);
    }
  }

  // ─── Inline Add Chapter in Volume ───────────────────────
  const isAddingChapter = ref(false);
  const newChapterTitle = ref('');
  const chapterInputRef = ref<HTMLInputElement | null>(null);

  function startAddingChapter() {
    isAddingChapter.value = true;
    newChapterTitle.value = '';
    nextTick(() => chapterInputRef.value?.focus());
  }

  function cancelAddChapter() {
    isAddingChapter.value = false;
    newChapterTitle.value = '';
  }

  async function submitAddChapter() {
    const title = newChapterTitle.value.trim();
    if (title) {
      await addPlannedChapter(title);
    }
    cancelAddChapter();
  }

  // ─── Reactive watcher ────────────────────────────────────
  watch(
    () => [props.project, props.volumeId, props.currentChapterId, chapterStore.currentChapterId],
    () => {
      load();
    },
    { immediate: true }
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
    load,
    toggleCollapse,
    toggleVolumeCollapse,
    toggleTodoStatus,
    cycleStatus,
    saveTodo,
    addTodo,
    deleteTodo,
    addPlannedChapter,
    startAddingChapter,
    cancelAddChapter,
    submitAddChapter,
    moveBacklogToChapter,
    attachArc
  };
}

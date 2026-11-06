import type { StoryArc } from '@/stores/story_arcs.store';
import type { Todo } from '@/types/generated/Todo';
import type { TapestryTodo, TodoStatus, TapestryChapterNode, TapestryArcGroup } from './PlanningPanel.model';
import type { PlanVolumeStats } from './components/PlanVolumeHeader/PlanVolumeHeader.model';

export function calculateVolumeStats(chapters: TapestryChapterNode[], backlog: TapestryTodo[]): PlanVolumeStats {
  let total = backlog.length;
  let done = backlog.filter(t => t.status === 'done' || t.done).length;
  let inProgress = backlog.filter(t => t.status === 'in_progress').length;
  let planned = backlog.filter(t => t.status === 'planned').length;
  let blocked = backlog.filter(t => t.status === 'blocked').length;

  for (const ch of chapters) {
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
}

export function getCleanId(id?: unknown): string {
  if (!id) return '';
  if (typeof id === 'object' && id !== null) {
    const obj = id as Record<string, unknown>;
    if (obj.id) return getCleanId(obj.id);
    return '';
  }
  return String(id).replace(/^(chapters|volumes|story_arcs|todos|projects|entities):/, '');
}

export function getQualifiedOwnerId(id?: string | null, type: 'chapter' | 'volume' = 'chapter'): string {
  const raw = (id || '').trim();
  if (!raw) return '';
  const clean = getCleanId(raw);
  return type === 'volume' ? `volumes:${clean}` : `chapters:${clean}`;
}

export function getPhaseLabel(phase?: string | null): string {
  switch (phase) {
    case 'setup': return '🌱 Завязка';
    case 'escalation': return '⚡ Эскалация';
    case 'climax': return '🔥 Кульминация';
    case 'resolution': return '✅ Развязка';
    default: return '🌱 Развитие';
  }
}

export function mapToTapestryTodo(raw: Todo): TapestryTodo {
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

export function linkCrossChapterCausality(nodes: TapestryChapterNode[]): void {
  const allTapestryTodos: TapestryTodo[] = [];
  const todoChapterMap = new Map<string, string>();

  for (const n of nodes) {
    for (const g of n.arcGroups) {
      for (const t of g.todos) {
        t.depends_on_title = null;
        t.blocks_title = null;
        t.blocks_chapter_id = null;
        allTapestryTodos.push(t);
        todoChapterMap.set(getCleanId(t.id), n.title);
      }
    }
    for (const t of n.standaloneTodos) {
      t.depends_on_title = null;
      t.blocks_title = null;
      t.blocks_chapter_id = null;
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
}

export const NEXT_STATUS_MAP: Record<TodoStatus, TodoStatus> = {
  planned: 'in_progress',
  in_progress: 'done',
  done: 'planned',
  blocked: 'planned'
};

export const CYCLE_STATUS_MAP: Record<TodoStatus, TodoStatus> = {
  planned: 'in_progress',
  in_progress: 'done',
  done: 'blocked',
  blocked: 'planned'
};

export function insertTodoIntoState(
  chapters: TapestryChapterNode[],
  backlog: TapestryTodo[],
  newTodo: TapestryTodo,
  rawOwnerId: string,
  arcId?: string | null,
  volumeId?: string | null
): void {
  const cleanOwnerId = getCleanId(rawOwnerId);
  const targetCh = chapters.find(c => getCleanId(c.chapterId) === cleanOwnerId);

  if (targetCh) {
    if (arcId) {
      const cleanArcId = getCleanId(arcId);
      const group = targetCh.arcGroups.find(g => getCleanId(g.arcId) === cleanArcId);
      if (group) {
        group.todos.push(newTodo);
      } else {
        targetCh.arcGroups.push({
          arcId,
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
  } else if (rawOwnerId.includes('volumes:') || (volumeId && cleanOwnerId === getCleanId(volumeId))) {
    backlog.push(newTodo);
  }
}

export function removeTodoFromState(
  chapters: TapestryChapterNode[],
  backlog: TapestryTodo[],
  todoId: string,
  isDone: boolean
): void {
  const cleanTodoId = getCleanId(todoId);
  for (const ch of chapters) {
    for (const grp of ch.arcGroups) {
      const idx = grp.todos.findIndex(t => getCleanId(t.id) === cleanTodoId);
      if (idx !== -1) {
        grp.todos.splice(idx, 1);
        ch.totalCount = Math.max(0, ch.totalCount - 1);
        if (isDone) ch.doneCount = Math.max(0, ch.doneCount - 1);
        return;
      }
    }
    const sIdx = ch.standaloneTodos.findIndex(t => getCleanId(t.id) === cleanTodoId);
    if (sIdx !== -1) {
      ch.standaloneTodos.splice(sIdx, 1);
      ch.totalCount = Math.max(0, ch.totalCount - 1);
      if (isDone) ch.doneCount = Math.max(0, ch.doneCount - 1);
      return;
    }
  }

  const bIdx = backlog.findIndex(t => getCleanId(t.id) === cleanTodoId);
  if (bIdx !== -1) {
    backlog.splice(bIdx, 1);
  }
}

export function cascadeUnblockDependencies(chapters: TapestryChapterNode[], parentTodoId: string): TapestryTodo[] {
  const cleanParentId = getCleanId(parentTodoId);
  const unblocked: TapestryTodo[] = [];
  for (const ch of chapters) {
    for (const grp of ch.arcGroups) {
      for (const item of grp.todos) {
        if (item.depends_on && getCleanId(item.depends_on) === cleanParentId && item.status === 'blocked') {
          item.status = 'planned';
          unblocked.push(item);
        }
      }
    }
    for (const item of ch.standaloneTodos) {
      if (item.depends_on && getCleanId(item.depends_on) === cleanParentId && item.status === 'blocked') {
        item.status = 'planned';
        unblocked.push(item);
      }
    }
  }
  return unblocked;
}

export function buildChapterArcGroups(
  tapestryTodos: TapestryTodo[],
  cleanChId: string,
  arcs: StoryArc[],
  arcChapters: Map<string, Array<{ chapter_id?: string; out?: string; phase?: string | null }>>
): { arcGroups: TapestryArcGroup[]; standaloneTodos: TapestryTodo[] } {
  const boundArcs = arcs.filter(arc => {
    if (!arc.id) return false;
    const relations = arcChapters.get(arc.id) || [];
    return relations.some(r => {
      const outCandidate = r.chapter_id || r.out;
      return outCandidate && getCleanId(outCandidate) === cleanChId;
    });
  });

  const arcGroups: TapestryArcGroup[] = [];
  const assignedTodoIds = new Set<string>();

  for (const arc of boundArcs) {
    if (!arc.id) continue;
    const cleanArcId = getCleanId(arc.id);
    const arcTodos = tapestryTodos.filter(t => t.arc_id && getCleanId(t.arc_id) === cleanArcId);
    arcTodos.forEach(t => assignedTodoIds.add(t.id));

    const relations = arcChapters.get(arc.id) || [];
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

  for (const t of tapestryTodos) {
    if (t.arc_id && !assignedTodoIds.has(t.id)) {
      const cleanArcId = getCleanId(t.arc_id);
      const foundArc = arcs.find(a => a.id && getCleanId(a.id) === cleanArcId);
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

  const standaloneTodos = tapestryTodos.filter(t => !assignedTodoIds.has(t.id));
  return { arcGroups, standaloneTodos };
}

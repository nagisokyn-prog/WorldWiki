import type { StoryArc } from '@/stores/story_arcs.store';
import type { TapestryChapterNode, TapestryTodo, TapestryVolumeBlock } from './PlanningPanel.model';
import {
  getCleanId,
  mapToTapestryTodo,
  linkCrossChapterCausality,
  buildChapterArcGroups,
  calculateVolumeStats,
} from './planningPanel.utils';

export type ArcChaptersMap = Map<
  string,
  Array<{ chapter_id?: string; out?: string; phase?: string | null }>
>;

export interface RawVolumeLike {
  id?: string | null;
  title?: string | null;
}

export interface RawChapterLike {
  id?: string | null;
  volume_id?: string | null;
  title?: string | null;
  sort_order?: number | bigint | null;
}

export function buildTapestryChapterNode(params: {
  ch: RawChapterLike;
  rawTodos: TapestryTodo[];
  currentCleanId: string | null;
  expandedChapters: Set<string>;
  allProjectArcs: StoryArc[];
  arcChapters: ArcChaptersMap;
}): TapestryChapterNode {
  const { ch, rawTodos, currentCleanId, expandedChapters, allProjectArcs, arcChapters } = params;
  const cleanChId = getCleanId(ch.id);
  const { arcGroups, standaloneTodos } = buildChapterArcGroups(
    rawTodos,
    cleanChId,
    allProjectArcs,
    arcChapters
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
    isCollapsed: !expandedChapters.has(cleanChId),
    arcGroups,
    standaloneTodos,
    doneCount,
    totalCount,
  };
}

export function assembleTapestryVolumeBlocks(params: {
  rawVolumes: RawVolumeLike[];
  allChapters: RawChapterLike[];
  volBacklogs: Array<Array<Parameters<typeof mapToTapestryTodo>[0]>>;
  chTodos: Array<Array<Parameters<typeof mapToTapestryTodo>[0]>>;
  currentCleanId: string | null;
  expandedChapters: Set<string>;
  collapsedVolumeIds: Set<string>;
  allProjectArcs: StoryArc[];
  arcChapters: ArcChaptersMap;
}): {
  blocks: TapestryVolumeBlock[];
  allNodes: TapestryChapterNode[];
  allBacklogs: TapestryTodo[];
} {
  const {
    rawVolumes,
    allChapters,
    volBacklogs,
    chTodos,
    currentCleanId,
    expandedChapters,
    collapsedVolumeIds,
    allProjectArcs,
    arcChapters,
  } = params;

  const chTodosMap = new Map<string, TapestryTodo[]>();
  allChapters.forEach((ch, idx) => {
    chTodosMap.set(getCleanId(ch.id), (chTodos[idx] || []).map(mapToTapestryTodo));
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

    const chapterNodes: TapestryChapterNode[] = matchingChapters.map((ch) =>
      buildTapestryChapterNode({
        ch,
        rawTodos: chTodosMap.get(getCleanId(ch.id)) || [],
        currentCleanId,
        expandedChapters,
        allProjectArcs,
        arcChapters,
      })
    );
    chapterNodes.sort((a, b) => a.sortOrder - b.sortOrder);

    blocks.push({
      volumeId: rawVolId,
      cleanVolumeId: cleanVolId,
      title: volTitle,
      isCollapsed: collapsedVolumeIds.has(cleanVolId),
      stats: calculateVolumeStats(chapterNodes, volBacklog),
      chapters: chapterNodes,
      chapterOptions: chapterNodes.map((c) => ({ chapterId: c.chapterId, title: c.title })),
      backlogTodos: volBacklog,
    });
  });

  const remainingChapters = allChapters.filter((c) => !assignedChapterIds.has(getCleanId(c.id)));
  if (remainingChapters.length > 0 && blocks.length > 0) {
    const firstBlock = blocks[0];
    const extraNodes = remainingChapters.map((ch) =>
      buildTapestryChapterNode({
        ch,
        rawTodos: chTodosMap.get(getCleanId(ch.id)) || [],
        currentCleanId,
        expandedChapters,
        allProjectArcs,
        arcChapters,
      })
    );
    firstBlock.chapters.push(...extraNodes);
    firstBlock.chapters.sort((a, b) => a.sortOrder - b.sortOrder);
    firstBlock.stats = calculateVolumeStats(firstBlock.chapters, firstBlock.backlogTodos);
    firstBlock.chapterOptions = firstBlock.chapters.map((c) => ({
      chapterId: c.chapterId,
      title: c.title,
    }));
  }

  const allNodes = blocks.flatMap((b) => b.chapters);
  linkCrossChapterCausality(allNodes);

  return {
    blocks,
    allNodes,
    allBacklogs: blocks.flatMap((b) => b.backlogTodos),
  };
}

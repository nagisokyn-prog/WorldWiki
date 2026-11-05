import { ref, computed, nextTick, type Ref, type ComputedRef } from 'vue';
import * as api from '@/services/api.client';
import { chapterService } from '@/services/chapter.service';
import { useChapterStore } from '@/stores/chapter.store';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { appAlert } from '@worldwiki/components';
import type {
  PlanningPanelEmitFn,
  TapestryChapterNode,
  TapestryVolumeBlock,
} from './PlanningPanel.model';
import {
  getCleanId,
  getQualifiedOwnerId,
  calculateVolumeStats,
} from './planningPanel.utils';

export interface OutliningContext {
  currentProject: ComputedRef<string>;
  resolvedVolumeId: ComputedRef<string | null>;
  volumeBlocks: Ref<TapestryVolumeBlock[]>;
  chaptersList: Ref<TapestryChapterNode[]>;
  expandedChapters: Ref<Set<string>>;
  manuallyCollapsedChapters: Ref<Set<string>>;
  collapsedVolumeIds: Ref<Set<string>>;
  loadTapestryData: () => Promise<void>;
  emit?: PlanningPanelEmitFn;
}

export function createPlanningOutliningActions(ctx: OutliningContext) {
  const chapterStore = useChapterStore();
  const storyArcsStore = useStoryArcsStore();

  const addingChapterVolumeId = ref<string | null>(null);
  const newChapterTitle = ref('');
  const chapterInputRef = ref<HTMLInputElement | null>(null);

  const isAddingVolume = ref(false);
  const newVolumeTitle = ref('');
  const volumeInputRef = ref<HTMLInputElement | null>(null);

  const isAddingChapter = computed(() => addingChapterVolumeId.value !== null);

  function toggleCollapse(chapterId: string) {
    const cleanId = getCleanId(chapterId);
    if (ctx.expandedChapters.value.has(cleanId)) {
      ctx.expandedChapters.value.delete(cleanId);
      ctx.manuallyCollapsedChapters.value.add(cleanId);
    } else {
      ctx.expandedChapters.value.add(cleanId);
      ctx.manuallyCollapsedChapters.value.delete(cleanId);
    }
    for (const block of ctx.volumeBlocks.value) {
      const ch = block.chapters.find((c) => getCleanId(c.chapterId) === cleanId);
      if (ch) ch.isCollapsed = !ctx.expandedChapters.value.has(cleanId);
    }
    const flatCh = ctx.chaptersList.value.find((c) => getCleanId(c.chapterId) === cleanId);
    if (flatCh) flatCh.isCollapsed = !ctx.expandedChapters.value.has(cleanId);
  }

  function toggleVolumeCollapse(volId?: string) {
    const targetVol = volId || ctx.resolvedVolumeId.value || ctx.volumeBlocks.value[0]?.volumeId;
    if (!targetVol) return;
    const cleanVol = getCleanId(targetVol);
    if (ctx.collapsedVolumeIds.value.has(cleanVol)) {
      ctx.collapsedVolumeIds.value.delete(cleanVol);
    } else {
      ctx.collapsedVolumeIds.value.add(cleanVol);
    }
    const block = ctx.volumeBlocks.value.find((b) => b.cleanVolumeId === cleanVol);
    if (block) block.isCollapsed = ctx.collapsedVolumeIds.value.has(cleanVol);
  }

  function startAddingChapter(volId?: string) {
    addingChapterVolumeId.value =
      volId || ctx.resolvedVolumeId.value || ctx.volumeBlocks.value[0]?.volumeId || null;
    newChapterTitle.value = '';
    nextTick(() => chapterInputRef.value?.focus());
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
      !ctx.volumeBlocks.value.some(
        (b) => b.volumeId === volIdOrTitle || b.cleanVolumeId === getCleanId(volIdOrTitle)
      )
    ) {
      title = volIdOrTitle.trim();
      targetVolId =
        addingChapterVolumeId.value ||
        ctx.resolvedVolumeId.value ||
        chapterStore.hierarchy?.volumes?.[0]?.id ||
        'volumes:vol_1';
    } else {
      targetVolId =
        volIdOrTitle ||
        addingChapterVolumeId.value ||
        ctx.resolvedVolumeId.value ||
        chapterStore.hierarchy?.volumes?.[0]?.id ||
        'volumes:vol_1';
      title = (newChapterTitle.value || volIdOrTitle || '').trim();
    }

    if (!title) {
      cancelAddChapter();
      return;
    }
    if (!targetVolId) return;

    try {
      const cleanVolId = getCleanId(targetVolId);
      const targetBlock = ctx.volumeBlocks.value.find((b) => b.cleanVolumeId === cleanVolId);
      const chsInVol = targetBlock ? targetBlock.chapters : ctx.chaptersList.value;
      const nextSortOrder = chsInVol.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1;

      const newCh = chapterService.createNew(title);
      const fullVolId = getQualifiedOwnerId(cleanVolId, 'volume');
      newCh.volume_id = fullVolId;
      newCh.sort_order = nextSortOrder as unknown as bigint;

      const saved = await chapterService.save(ctx.currentProject.value, newCh);
      const newChId = typeof saved === 'string' && saved ? saved : newCh.id || '';

      await api.assignChapter(ctx.currentProject.value, newChId, fullVolId);

      const newNode: TapestryChapterNode = {
        chapterId: newChId,
        title,
        sortOrder: nextSortOrder,
        isCurrent: false,
        isCollapsed: true,
        arcGroups: [],
        standaloneTodos: [],
        doneCount: 0,
        totalCount: 0,
      };

      if (targetBlock) {
        targetBlock.chapters.push(newNode);
        targetBlock.stats = calculateVolumeStats(targetBlock.chapters, targetBlock.backlogTodos);
        targetBlock.chapterOptions = targetBlock.chapters.map((c) => ({
          chapterId: c.chapterId,
          title: c.title,
        }));
      }
      ctx.chaptersList.value.push(newNode);

      if (chapterStore.hierarchy?.chapters) {
        chapterStore.hierarchy.chapters.push({
          id: newChId,
          volume_id: fullVolId,
          title,
          sort_order: nextSortOrder as unknown as bigint,
          content: '',
          word_count: 0 as unknown as bigint,
        } as never);
      }

      cancelAddChapter();
      ctx.emit?.('change');
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
    nextTick(() => volumeInputRef.value?.focus());
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
      await api.createVolume(ctx.currentProject.value, title);
      await chapterStore.loadChapters(ctx.currentProject.value);
      cancelAddVolume();
      await ctx.loadTapestryData();
      ctx.emit?.('change');
    } catch (e) {
      console.error('[submitAddVolume ERROR]:', e);
      appAlert('Не удалось создать новый том');
    }
  }

  async function attachArc(
    payloadOrChapterId: { chapterId: string; arcId: string } | string,
    maybeArcId?: string
  ) {
    const chapterId =
      typeof payloadOrChapterId === 'string' ? payloadOrChapterId : payloadOrChapterId.chapterId;
    const arcId =
      typeof payloadOrChapterId === 'string' ? maybeArcId || '' : payloadOrChapterId.arcId;
    try {
      await storyArcsStore.bindChapter({ arc_id: arcId, chapter_id: getCleanId(chapterId) });
      await ctx.loadTapestryData();
      ctx.emit?.('change');
    } catch (e) {
      appAlert('Не удалось привязать сюжетную арку');
      console.error(e);
    }
  }

  return {
    addingChapterVolumeId,
    isAddingChapter,
    newChapterTitle,
    chapterInputRef,
    isAddingVolume,
    newVolumeTitle,
    volumeInputRef,
    toggleCollapse,
    toggleVolumeCollapse,
    startAddingChapter,
    cancelAddChapter,
    addPlannedChapter,
    submitAddChapter,
    startAddVolume,
    cancelAddVolume,
    submitAddVolume,
    attachArc,
  };
}


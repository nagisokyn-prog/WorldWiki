import { watch, onMounted, onUnmounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useChapterStore } from '../../../stores/chapter.store';
import { useChapterHistory } from './hooks/useChapterHistory';
import { useChapterLayout } from './hooks/useChapterLayout';
import { useFloatingEntities } from './hooks/useFloatingEntities';
import { useChapterParticipants } from './hooks/useChapterParticipants';
import { useChapterPromisesBridge } from './hooks/useChapterPromisesBridge';
import { useTimelineStore } from '../../../stores/timeline.store';
import type { ExportPayload } from '../Export/useExportModal';
import type { Chapter } from '../../../types/generated/Chapter';
import type ChapterRightSidebar from './components/ChapterRightSidebar.vue';

export interface ChapterTreeNode {
  id?: string;
  title?: string;
  [key: string]: unknown;
}

export interface ActiveTreeNode {
  type: string;
  node: ChapterTreeNode;
}

export interface ChaptersMainProps {
  project: string;
  controlledChapterId?: string;
  activeTreeNode?: ActiveTreeNode;
}

export function useChaptersMain(
  props: ChaptersMainProps,
  emit: (event: string, ...args: unknown[]) => void
) {
  const store = useChapterStore();
  const {
    loading, chapters, hierarchy, currentChapterId, currentChapter,
    hasUnsavedChanges, debugError, isSaving,
    currentChapterNode, currentVolume,
  } = storeToRefs(store);

  const {
    loadChapters, saveChapter, openChapter,
    createNewChapter, onRenameChapter, deleteChapter,
  } = store;

  const historyHook = useChapterHistory(props.project, currentChapterId, currentChapter);
  const layoutHook = useChapterLayout();
  const floatingHook = useFloatingEntities(props.project);

  const localActiveTreeNode = ref<ActiveTreeNode | undefined>(undefined);
  const chapterTreeRef = ref<{ load: () => Promise<void> } | null>(null);

  const editorCoreRef = ref<{ scrollToParagraph: (idx: number, quote?: string, blockId?: string) => void } | null>(null);
  const rightSidebarRef = ref<InstanceType<typeof ChapterRightSidebar> | null>(null);
  const isTimelineOpen = ref(true);
  const isParticipantsOpen = ref(true);

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleGlobalChapterRename = (e: Event) => {
    const { id, title } = (e as CustomEvent<{ id: string; title: string }>).detail;
    if (currentChapter.value && String(currentChapter.value.id) === String(id)) {
      if (currentChapter.value.title !== title) {
        currentChapter.value.title = title;
      }
    }
  };

  const triggerSave = () => {
    saveChapter(props.project, emit);
  };

  const reloadHierarchy = () => {
    loadChapters(props.project);
  };

  const onTreeNodeSelect = (nodeData: ActiveTreeNode) => {
    localActiveTreeNode.value = nodeData;
  };

  const openChapterFromTree = async (ch: ChapterTreeNode) => {
    localActiveTreeNode.value = { type: 'chapter', node: ch };
    emit('open-chapter-as-tab', ch);
  };

  const markUnsaved = () => {
    hasUnsavedChanges.value = true;
    syncAutoParticipants();
    emit('chapter-unsaved');
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveChapter(props.project, emit), 2000);
  };

  const { syncAutoParticipants, handleAddParticipant } = useChapterParticipants(
    currentChapter,
    markUnsaved
  );

  const promisesBridge = useChapterPromisesBridge({
    project: props.project,
    currentChapter,
    chapters,
    hierarchy,
    editorCoreRef,
    rightSidebarRef,
    openChapterFromTree,
  });

  const onAddParticipantEvent = (e: Event) => {
    const detail = (e as CustomEvent<{ type: string; id: string; name?: string }>).detail;
    if (detail) handleAddParticipant(detail);
  };

  onMounted(async () => {
    await loadChapters(props.project);
    await useTimelineStore().init(props.project);

    if (props.controlledChapterId) {
      await openChapter(props.project, props.controlledChapterId);
    }

    document.addEventListener('ww:trigger-chapter-save', triggerSave as EventListener);
    document.addEventListener('ww:hierarchy-changed', reloadHierarchy as EventListener);
    document.addEventListener('ww:chapter-renamed', handleGlobalChapterRename as EventListener);
    document.addEventListener('ww:add-participant', onAddParticipantEvent as EventListener);
  });

  onUnmounted(() => {
    document.removeEventListener('ww:trigger-chapter-save', triggerSave as EventListener);
    document.removeEventListener('ww:hierarchy-changed', reloadHierarchy as EventListener);
    document.removeEventListener('ww:chapter-renamed', handleGlobalChapterRename as EventListener);
    document.removeEventListener('ww:add-participant', onAddParticipantEvent as EventListener);
    if (saveTimeout) clearTimeout(saveTimeout);
  });

  watch(() => props.controlledChapterId, async (newId) => {
    if (newId && newId !== currentChapterId.value) {
      await openChapter(props.project, newId);
    }
  });

  watch(() => props.activeTreeNode, (node) => {
    if (node) {
      localActiveTreeNode.value = node;
    } else {
      localActiveTreeNode.value = undefined;
      if (!props.controlledChapterId) {
        currentChapter.value = null;
        currentChapterId.value = undefined;
      }
    }
  }, { immediate: true });

  const createChapterIn = async ({ volumeId }: { volumeId?: string } = {}) => {
    await createNewChapter(props.project, volumeId);
    await chapterTreeRef.value?.load();
  };

  const handleRenameChapter = async (chapter: Chapter | ChapterTreeNode, newTitle: string) => {
    await onRenameChapter(props.project, chapter as Chapter, newTitle);
    await chapterTreeRef.value?.load();
  };

  const handleDeleteChapter = (original: { id?: string | null }, multi: boolean) => {
    if (multi || !original.id) return;
    deleteChapter(props.project, original.id).then(() => {
      chapterTreeRef.value?.load();
      localActiveTreeNode.value = undefined;
    });
  };

  const handleExport = async (exportData: ExportPayload) => {
    const { appAlert } = await import('@worldwiki/components');
    appAlert(`Начат экспорт ${exportData.chapterIds.length} глав в формат ${exportData.format}...`);
  };

  const handleScrollChange = (scroll: number) => {
    if (currentChapter.value) {
      currentChapter.value.scrollPos = scroll;
    }
    emit('scroll-change', scroll);
  };

  return {
    loading, chapters, hierarchy, currentChapterId, currentChapter,
    hasUnsavedChanges, debugError, isSaving, localActiveTreeNode, chapterTreeRef,
    currentChapterNode, currentVolume,
    editorCoreRef, rightSidebarRef, isTimelineOpen, isParticipantsOpen,
    ...promisesBridge,
    ...historyHook,
    ...layoutHook,
    ...floatingHook,
    triggerSave, markUnsaved, onTreeNodeSelect, openChapterFromTree,
    createChapterIn, handleRenameChapter, handleDeleteChapter, handleExport,
    handleScrollChange, handleAddParticipant,
  };
}

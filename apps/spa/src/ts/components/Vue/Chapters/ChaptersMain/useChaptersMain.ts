import { watch, onMounted, onUnmounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useChapterStore } from '../../../../stores/chapter.store';
import { useChapterHistory } from './hooks/useChapterHistory';
import { useChapterLayout } from './hooks/useChapterLayout';
import { useFloatingEntities } from './hooks/useFloatingEntities';
import { timelineService } from '../../../../services/timeline.service';

export function useChaptersMain(props: any, emit: any) {
  const store = useChapterStore();
  const { 
    loading, chapters, hierarchy, currentChapterId, currentChapter, 
    hasUnsavedChanges, debugError, isSaving,
    currentChapterNode, currentArc, currentVolume
  } = storeToRefs(store);

  const {
    loadChapters, saveChapter, openChapter, 
    createNewChapter, onRenameChapter, deleteChapter
  } = store;

  const historyHook = useChapterHistory(props.project, currentChapterId, currentChapter);
  const layoutHook = useChapterLayout();
  const floatingHook = useFloatingEntities(props.project);

  const localActiveTreeNode = ref<{ type: string; node: any } | undefined>(undefined);
  const chapterTreeRef = ref<any>(null);
  
  let saveTimeout: any = null;

  onMounted(async () => {
    console.log('🚀 ChaptersMain onMounted');
    await loadChapters(props.project);
    await timelineService.init(props.project);

    if (props.controlledChapterId) {
      await openChapter(props.project, props.controlledChapterId);
    }
    
    document.addEventListener('ww:trigger-chapter-save', triggerSave as any);
    document.addEventListener('ww:hierarchy-changed', reloadHierarchy as any);
  });

  onUnmounted(() => {
    document.removeEventListener('ww:trigger-chapter-save', triggerSave as any);
    document.removeEventListener('ww:hierarchy-changed', reloadHierarchy as any);
    if (saveTimeout) clearTimeout(saveTimeout);
  });
  
  const reloadHierarchy = () => {
    loadChapters(props.project);
  }

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

  const triggerSave = () => {
    saveChapter(props.project, emit);
  };

  const markUnsaved = () => {
    hasUnsavedChanges.value = true;
    emit('chapter-unsaved');
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveChapter(props.project, emit), 2000);
  };

  const onTreeNodeSelect = (nodeData: { type: string; node: any }) => {
    localActiveTreeNode.value = nodeData;
  };

  const openChapterFromTree = async (ch: any) => {
    localActiveTreeNode.value = { type: 'chapter', node: ch };
    emit('open-chapter-as-tab', ch);
  };

  const createChapterIn = async ({ arcId, volumeId }: { arcId?: string; volumeId?: string }) => {
    await createNewChapter(props.project, arcId, volumeId);
    await chapterTreeRef.value?.load();
  };
  
  const handleRenameChapter = async (chapter: any, newTitle: string) => {
    await onRenameChapter(props.project, chapter, newTitle);
    await chapterTreeRef.value?.load();
  };
  
  const handleDeleteChapter = (original: any, multi: boolean) => {
    if (multi) return;
    deleteChapter(props.project, original.id).then(() => {
        chapterTreeRef.value?.load();
        localActiveTreeNode.value = undefined;
    });
  };

  const handleExport = (exportData: any) => {
    alert(`Начат экспорт ${exportData.chapterIds.length} глав в формат ${exportData.format}...`);
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
    currentChapterNode, currentArc, currentVolume,
    ...historyHook,
    ...layoutHook,
    ...floatingHook,
    triggerSave, markUnsaved, onTreeNodeSelect, openChapterFromTree,
    createChapterIn, createNewChapter: async (a?: string, v?: string) => { await createNewChapter(props.project, a, v); await chapterTreeRef.value?.load(); },
    onRenameChapter: handleRenameChapter, onDeleteChapter: handleDeleteChapter, deleteChapter: (id: string) => deleteChapter(props.project, id),
    handleExport, handleScrollChange, saveChapter: () => saveChapter(props.project, emit),
    loadChapters: () => loadChapters(props.project), loadHierarchy: reloadHierarchy,
    openChapter: (id: string) => openChapter(props.project, id)
  };
}

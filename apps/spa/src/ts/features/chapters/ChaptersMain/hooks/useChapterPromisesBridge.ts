import { ref, onMounted, type Ref } from 'vue';
import { openCharacterJourneyWindow } from '../../../../utils/windowManager';
import type { ChapterWithHierarchy, ChapterHierarchy } from '../../../../stores/chapter.store';
import type { ChapterTreeNode } from '../useChaptersMain';
import type ChapterRightSidebar from '../components/ChapterRightSidebar.vue';

interface PromiseBridgeDeps {
  project: string;
  currentChapter: Ref<ChapterWithHierarchy | null>;
  chapters: Ref<ChapterWithHierarchy[]>;
  hierarchy: Ref<ChapterHierarchy | null>;
  editorCoreRef: Ref<{ scrollToParagraph: (idx: number, quote?: string, blockId?: string) => void } | null>;
  rightSidebarRef: Ref<InstanceType<typeof ChapterRightSidebar> | null>;
  openChapterFromTree: (ch: ChapterTreeNode) => Promise<void>;
}

export function useChapterPromisesBridge(deps: PromiseBridgeDeps) {
  const {
    project,
    currentChapter,
    chapters,
    hierarchy,
    editorCoreRef,
    rightSidebarRef,
    openChapterFromTree,
  } = deps;

  const isJourneyOpen = ref(false);

  const openJourney = async () => {
    const opened = await openCharacterJourneyWindow(project);
    if (!opened) {
      isJourneyOpen.value = true;
    }
  };

  const closeJourney = () => {
    isJourneyOpen.value = false;
  };

  const handleCreatePromise = (payload: {
    kind: string;
    quote: string;
    paragraph_index: number;
    block_id?: string | null;
  }) => {
    rightSidebarRef.value?.addPromise(payload);
  };

  const handleLinkMilestone = (payload: {
    promiseId: string;
    stage: 'progression' | 'resolution';
    quote: string;
    paragraph_index: number;
    block_id?: string | null;
  }) => {
    rightSidebarRef.value?.addMilestone({
      ...payload,
      chapterId: currentChapter.value?.id || undefined,
    });
  };

  const handleLocatePromise = (payload: {
    chapterId: string;
    paragraphIndex: number;
    quote: string;
    blockId?: string;
  }) => {
    const cleanTarget = (payload.chapterId || '').split(':').pop()?.replace(/["'`]/g, '').trim() || '';
    const currentClean = (currentChapter.value?.id || '').split(':').pop()?.replace(/["'`]/g, '').trim() || '';

    if (currentClean && cleanTarget && cleanTarget !== currentClean) {
      const allList = chapters.value.length > 0 ? chapters.value : (hierarchy.value?.chapters || []);
      const targetChapter = allList.find((c: { id?: string | null }) => {
        const cClean = (c.id || '').split(':').pop()?.replace(/["'`]/g, '').trim() || '';
        return cClean === cleanTarget;
      });

      if (targetChapter) {
        const targetId = targetChapter.id
          ? (String(targetChapter.id).startsWith('chapters:') ? String(targetChapter.id) : `chapters:${String(targetChapter.id)}`)
          : `chapters:${cleanTarget}`;

        const chNode = {
          ...targetChapter,
          id: targetId,
          title: targetChapter.title || 'Глава',
        } as unknown as ChapterTreeNode;

        void openChapterFromTree(chNode);
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('ww:locate-promise', {
            detail: payload,
          }));
        }, 450);
        return;
      }
    }

    editorCoreRef.value?.scrollToParagraph(payload.paragraphIndex, payload.quote, payload.blockId);
  };

  const handleJourneySelectScene = (item: {
    chapter_id?: string;
    paragraph_index?: number | null;
    title?: string;
    block_id?: string | null;
  }) => {
    if (item.chapter_id) {
      handleLocatePromise({
        chapterId: item.chapter_id,
        paragraphIndex: item.paragraph_index ?? 0,
        quote: item.title || '',
        blockId: item.block_id || undefined,
      });
    }
  };

  onMounted(() => {
    if (typeof window !== 'undefined' && window.__TAURI__) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<{
          chapterId?: string;
          paragraphIndex?: number;
          blockId?: string;
          item?: { chapter_id?: string; paragraph_index?: number; block_id?: string; title?: string };
        }>('ww-journey-select-scene', (event) => {
          const payload = event.payload;
          const chapterId = payload.chapterId || payload.item?.chapter_id;
          if (chapterId) {
            handleLocatePromise({
              chapterId,
              paragraphIndex: payload.paragraphIndex ?? payload.item?.paragraph_index ?? 0,
              quote: payload.item?.title || '',
              blockId: payload.blockId || payload.item?.block_id || undefined,
            });
          }
        });
      }).catch((e) => console.warn('Tauri event listen error in useChapterPromisesBridge:', e));
    }
  });

  return {
    isJourneyOpen,
    openJourney,
    closeJourney,
    handleCreatePromise,
    handleLinkMilestone,
    handleLocatePromise,
    handleJourneySelectScene,
  };
}

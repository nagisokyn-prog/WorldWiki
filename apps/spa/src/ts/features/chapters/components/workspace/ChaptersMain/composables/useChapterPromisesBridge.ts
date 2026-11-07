import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { openCharacterJourneyWindow } from '@/utils/windowManager';
import type { ChapterWithHierarchy, ChapterHierarchy } from '@/stores/chapter.store';
import type { ChapterTreeNode } from '../useChaptersMain';
import type ChapterRightSidebar from '../components/ChapterRightSidebar/ChapterRightSidebar.vue';

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
    block_ids?: string[];
  }) => {
    rightSidebarRef.value?.addPromise(payload);
  };

  const handleLinkMilestone = (payload: {
    promiseId: string;
    stage: 'progression' | 'resolution';
    quote: string;
    paragraph_index: number;
    block_id?: string | null;
    block_ids?: string[];
  }) => {
    rightSidebarRef.value?.addMilestone({
      ...payload,
      chapterId: currentChapter.value?.id || undefined,
    });
  };

  const handleLinkSubScene = (payload: {
    parentPromiseId: string;
    quote: string;
    paragraph_index: number;
    block_id?: string | null;
    block_ids?: string[];
  }) => {
    const parent = rightSidebarRef.value?.promises?.find((p: { id?: string | null }) => p.id === payload.parentPromiseId);
    if (parent && rightSidebarRef.value?.addSubScene) {
      rightSidebarRef.value.addSubScene(parent, {
        quote: payload.quote,
        paragraph_index: payload.paragraph_index,
        block_id: payload.block_id,
        block_ids: payload.block_ids,
        chapterId: currentChapter.value?.id || undefined
      });
    }
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
        const tryLocate = (attempts = 0) => {
          document.dispatchEvent(new CustomEvent('ww:locate-promise', {
            detail: payload,
          }));
          if (attempts < 3) {
            setTimeout(() => tryLocate(attempts + 1), 250);
          }
        };
        setTimeout(() => tryLocate(0), 100);
        return;
      }
    }

    editorCoreRef.value?.scrollToParagraph(payload.paragraphIndex, payload.quote, payload.blockId);
    document.dispatchEvent(new CustomEvent('ww:locate-promise', {
      detail: payload,
    }));
  };

  const handleJourneySelectScene = (item: {
    chapter_id?: string;
    paragraph_index?: number | null;
    title?: string;
    fullText?: string;
    block_id?: string | null;
  }) => {
    if (item.chapter_id) {
      handleLocatePromise({
        chapterId: item.chapter_id,
        paragraphIndex: item.paragraph_index ?? 0,
        quote: item.fullText || item.title || '',
        blockId: item.block_id || undefined,
      });
    }
  };

  let unlistenFn: UnlistenFn | null = null;

  const onWindowMessage = (event: MessageEvent) => {
    if (event.data?.type === 'JOURNEY_SELECT_SCENE') {
      const data = event.data;
      const chapterId = data.chapterId || data.item?.chapter_id;
      if (chapterId) {
        handleLocatePromise({
          chapterId,
          paragraphIndex: data.paragraphIndex ?? data.item?.paragraph_index ?? 0,
          quote: data.quote || data.item?.fullText || data.item?.title || '',
          blockId: data.blockId || data.item?.block_id || undefined,
        });
      }
    }
  };

  onMounted(async () => {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', onWindowMessage);
    }
    if (typeof window !== 'undefined' && window.__TAURI__) {
      try {
        unlistenFn = await listen<{
          chapterId?: string;
          paragraphIndex?: number;
          blockId?: string;
          item?: { chapter_id?: string; paragraph_index?: number; block_id?: string; title?: string; fullText?: string };
        }>('ww-journey-select-scene', (event) => {
          const payload = event.payload;
          const chapterId = payload.chapterId || payload.item?.chapter_id;
          if (chapterId) {
            handleLocatePromise({
              chapterId,
              paragraphIndex: payload.paragraphIndex ?? payload.item?.paragraph_index ?? 0,
              quote: payload.item?.fullText || payload.item?.title || '',
              blockId: payload.blockId || payload.item?.block_id || undefined,
            });
          }
        });
      } catch (err) {
        console.warn('[useChapterPromisesBridge] Failed to initialize Tauri event listener:', err);
      }
    }
  });

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', onWindowMessage);
    }
    if (unlistenFn) {
      unlistenFn();
      unlistenFn = null;
    }
  });

  return {
    isJourneyOpen,
    openJourney,
    closeJourney,
    handleCreatePromise,
    handleLinkMilestone,
    handleLinkSubScene,
    handleLocatePromise,
    handleJourneySelectScene,
  };
}

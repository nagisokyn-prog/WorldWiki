import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, defineComponent } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { useChapterPromisesBridge } from './useChapterPromisesBridge';
import * as windowManager from '@/utils/windowManager';
import { listen } from '@tauri-apps/api/event';
import type { ChapterWithHierarchy, ChapterHierarchy } from '@/stores/chapter.store';
import type { ChapterTreeNode } from '../useChaptersMain';

vi.mock('@/utils/windowManager', () => ({
  openCharacterJourneyWindow: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

describe('useChapterPromisesBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  });

  const setupBridge = (overrides?: Partial<Parameters<typeof useChapterPromisesBridge>[0]>) => {
    const addPromise = vi.fn();
    const addMilestone = vi.fn();
    const addSubScene = vi.fn();
    const scrollToParagraph = vi.fn();
    const openChapterFromTree = vi.fn().mockResolvedValue(undefined);

    const rightSidebarRef = ref({
      addPromise,
      addMilestone,
      addSubScene,
      promises: [{ id: 'p1', quote: 'Parent' }],
    }) as unknown as Parameters<typeof useChapterPromisesBridge>[0]['rightSidebarRef'];

    const editorCoreRef = ref({ scrollToParagraph });
    const currentChapter = ref<ChapterWithHierarchy | null>({ id: 'chapters:1', title: 'Ch1' } as ChapterWithHierarchy);
    const chapters = ref<ChapterWithHierarchy[]>([
      { id: 'chapters:1', title: 'Ch1' } as ChapterWithHierarchy,
      { id: 'chapters:2', title: 'Ch2' } as ChapterWithHierarchy,
    ]);
    const hierarchy = ref<ChapterHierarchy | null>(null);

    let bridge!: ReturnType<typeof useChapterPromisesBridge>;
    const Comp = defineComponent({
      setup() {
        bridge = useChapterPromisesBridge({
          project: 'proj-1',
          currentChapter,
          chapters,
          hierarchy,
          editorCoreRef,
          rightSidebarRef,
          openChapterFromTree,
          ...overrides,
        });
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    return {
      wrapper,
      bridge,
      addPromise,
      addMilestone,
      addSubScene,
      scrollToParagraph,
      openChapterFromTree,
    };
  };

  it('opens and closes journey modal depending on openCharacterJourneyWindow result', async () => {
    vi.mocked(windowManager.openCharacterJourneyWindow).mockResolvedValueOnce(false);
    const { bridge, wrapper } = setupBridge();

    await bridge.openJourney();
    expect(bridge.isJourneyOpen.value).toBe(true);
    bridge.closeJourney();
    expect(bridge.isJourneyOpen.value).toBe(false);

    vi.mocked(windowManager.openCharacterJourneyWindow).mockResolvedValueOnce(true);
    await bridge.openJourney();
    expect(bridge.isJourneyOpen.value).toBe(false);
    wrapper.unmount();
  });

  it('forwards create promise, milestone, and subscene to rightSidebarRef', () => {
    const { bridge, addPromise, addMilestone, addSubScene, wrapper } = setupBridge();

    bridge.handleCreatePromise({ kind: 'gun', quote: 'Q', paragraph_index: 1 });
    expect(addPromise).toHaveBeenCalledWith({ kind: 'gun', quote: 'Q', paragraph_index: 1 });

    bridge.handleLinkMilestone({ promiseId: 'p1', stage: 'progression', quote: 'M', paragraph_index: 2 });
    expect(addMilestone).toHaveBeenCalledWith(expect.objectContaining({ promiseId: 'p1', chapterId: 'chapters:1' }));

    bridge.handleLinkSubScene({ parentPromiseId: 'p1', quote: 'S', paragraph_index: 3 });
    expect(addSubScene).toHaveBeenCalledWith(
      { id: 'p1', quote: 'Parent' },
      expect.objectContaining({ quote: 'S', chapterId: 'chapters:1' })
    );

    bridge.handleLinkSubScene({ parentPromiseId: 'missing', quote: 'S', paragraph_index: 3 });
    expect(addSubScene).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('locates promises in current chapter and switches chapter when target differs', () => {
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
    const { bridge, scrollToParagraph, openChapterFromTree, wrapper } = setupBridge();

    // Same chapter
    bridge.handleLocatePromise({ chapterId: 'chapters:1', paragraphIndex: 4, quote: 'Q1', blockId: 'b1' });
    expect(scrollToParagraph).toHaveBeenCalledWith(4, 'Q1', 'b1');
    expect(dispatchSpy).toHaveBeenCalled();

    // Different chapter
    bridge.handleJourneySelectScene({ chapter_id: 'chapters:2', paragraph_index: 2, title: 'T2', block_id: 'b2' });
    expect(openChapterFromTree).toHaveBeenCalledWith(expect.objectContaining({ id: 'chapters:2', title: 'Ch2' } as Partial<ChapterTreeNode>));

    vi.advanceTimersByTime(1000);
    expect(dispatchSpy.mock.calls.length).toBeGreaterThanOrEqual(4);

    dispatchSpy.mockRestore();
    wrapper.unmount();
  });

  it('handles window message and Tauri listener with cleanup on unmount', async () => {
    const unlisten = vi.fn();
    let tauriCb: ((e: { payload: Record<string, unknown> }) => void) | undefined;
    vi.mocked(listen).mockImplementationOnce(async (_ev, cb) => {
      tauriCb = cb as typeof tauriCb;
      return unlisten;
    });
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {};

    const { scrollToParagraph, wrapper } = setupBridge();
    await flushPromises();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'JOURNEY_SELECT_SCENE', chapterId: 'chapters:1', paragraphIndex: 5, quote: 'Msg' },
      })
    );
    expect(scrollToParagraph).toHaveBeenCalledWith(5, 'Msg', undefined);

    tauriCb?.({ payload: { chapterId: 'chapters:1', paragraphIndex: 6, item: { fullText: 'TauriQ' } } });
    expect(scrollToParagraph).toHaveBeenCalledWith(6, 'TauriQ', undefined);

    wrapper.unmount();
    expect(unlisten).toHaveBeenCalled();
  });

  it('covers openJourney true/false, handleCreatePromise, handleLinkMilestone, handleLinkSubScene, missing chapter_id, and Tauri listen error', async () => {
    const { openCharacterJourneyWindow } = await import('@/utils/windowManager');
    vi.mocked(openCharacterJourneyWindow).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(listen).mockRejectedValueOnce(new Error('tauri listen fail'));
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {};

    const addPromise = vi.fn();
    const addMilestone = vi.fn();
    const addSubScene = vi.fn();
    const openChapterFromTree = vi.fn(async () => {});
    const scrollToParagraph = vi.fn();

    let bridge!: ReturnType<typeof useChapterPromisesBridge>;
    const Comp = defineComponent({
      setup() {
        bridge = useChapterPromisesBridge({
          project: 'p1',
          currentChapter: ref({ id: 'chapters:1', title: 'Ch1' } as never),
          chapters: ref([]),
          hierarchy: ref({ chapters: [{ id: '2', title: '' }] } as never),
          editorCoreRef: ref({ scrollToParagraph }),
          rightSidebarRef: ref({
            promises: [{ id: 'pr_1' }],
            addPromise,
            addMilestone,
            addSubScene,
          } as never),
          openChapterFromTree,
        });
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    await flushPromises();

    await bridge.openJourney();
    expect(bridge.isJourneyOpen.value).toBe(false);
    await bridge.openJourney();
    expect(bridge.isJourneyOpen.value).toBe(true);
    bridge.closeJourney();
    expect(bridge.isJourneyOpen.value).toBe(false);

    bridge.handleCreatePromise({ kind: 'gun', quote: 'Q', paragraph_index: 1 });
    expect(addPromise).toHaveBeenCalled();

    bridge.handleLinkMilestone({ promiseId: 'pr_1', stage: 'progression', quote: 'M', paragraph_index: 2 });
    expect(addMilestone).toHaveBeenCalled();

    bridge.handleLinkSubScene({ parentPromiseId: 'missing', quote: 'S', paragraph_index: 3 });
    expect(addSubScene).not.toHaveBeenCalled();
    bridge.handleLinkSubScene({ parentPromiseId: 'pr_1', quote: 'S', paragraph_index: 3 });
    expect(addSubScene).toHaveBeenCalled();

    // Locate chapter found in hierarchy without chapters: prefix & empty title
    bridge.handleLocatePromise({ chapterId: '2', paragraphIndex: 1, quote: 'Q' });
    expect(openChapterFromTree).toHaveBeenCalledWith(expect.objectContaining({ id: 'chapters:2', title: 'Глава' }));

    // handleJourneySelectScene without chapter_id -> no-op
    bridge.handleJourneySelectScene({ paragraph_index: 1 });
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'OTHER' } }));
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'JOURNEY_SELECT_SCENE' } }));

    wrapper.unmount();
    warnSpy.mockRestore();
  });
});

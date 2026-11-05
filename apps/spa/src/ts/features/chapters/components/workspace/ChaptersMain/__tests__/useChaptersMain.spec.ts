import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, reactive, nextTick } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useChaptersMain } from '../useChaptersMain';
import { appAlert } from '@worldwiki/components';

let mockStore: any;
let mockTimelineInit: any;

vi.mock('../../../../stores/chapter.store', () => ({
  useChapterStore: () => mockStore,
}));

vi.mock('../../../../stores/timeline.store', () => ({
  useTimelineStore: () => ({
    init: mockTimelineInit,
    parseParticipants: vi.fn().mockReturnValue([]),
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn(),
  settingsService: {
    getSettings: () => ({}),
    onChange: vi.fn(),
  },
}));

vi.mock('../composables/useChapterHistory', () => ({
  useChapterHistory: () => ({ history: ref([]) }),
}));

vi.mock('../composables/useFloatingEntities', () => ({
  useFloatingEntities: () => ({ floatingEntities: ref([]) }),
}));

describe('useChaptersMain', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    emit = vi.fn();
    props = {
      project: 'proj_1',
      controlledChapterId: null,
      activeTreeNode: null,
    };

    mockTimelineInit = vi.fn().mockResolvedValue(undefined);
    mockStore = {
      loading: ref(false),
      chapters: ref([]),
      hierarchy: ref({ volumes: [], chapters: [] }),
      currentChapterId: ref('ch_1'),
      currentChapter: ref({ id: 'ch_1', title: 'Prologue', scrollPos: 0 }),
      hasUnsavedChanges: ref(false),
      debugError: ref(''),
      isSaving: ref(false),
      currentChapterNode: ref(null),
      currentVolume: ref(null),
      loadChapters: vi.fn().mockResolvedValue([]),
      saveChapter: vi.fn(),
      openChapter: vi.fn().mockResolvedValue(undefined),
      createNewChapter: vi.fn().mockResolvedValue(undefined),
      onRenameChapter: vi.fn().mockResolvedValue(undefined),
      deleteChapter: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes onMounted, loads chapters and opens controlled chapter when provided', async () => {
    const TestComponent = defineComponent({
      props: ['project', 'controlledChapterId', 'activeTreeNode'],
      setup(p, { emit: e }) {
        return { ...useChaptersMain(p, e) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent, {
      props: {
        project: 'proj_1',
        controlledChapterId: 'ch_target',
        activeTreeNode: null,
      },
    });

    await flushPromises();

    expect(mockStore.loadChapters).toHaveBeenCalledWith('proj_1');
    expect(mockTimelineInit).toHaveBeenCalledWith('proj_1');
    expect(mockStore.openChapter).toHaveBeenCalledWith('proj_1', 'ch_target');

    wrapper.unmount();
  });

  it('handles custom event listeners (save, reload hierarchy, rename branches)', async () => {
    const TestComponent = defineComponent({
      props: ['project', 'controlledChapterId', 'activeTreeNode'],
      setup(p, { emit: e }) {
        return { ...useChaptersMain(p, e) };
      },
      template: '<div></div>',
    });

    const wrapper = mount(TestComponent, {
      props: {
        project: 'proj_1',
        controlledChapterId: 'ch_1',
        activeTreeNode: null,
      },
    });

    await flushPromises();

    // Trigger save custom event
    document.dispatchEvent(new CustomEvent('ww:trigger-chapter-save'));
    expect(mockStore.saveChapter).toHaveBeenCalled();

    // Trigger hierarchy changed event
    document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
    expect(mockStore.loadChapters).toHaveBeenCalled();

    // Set current chapter
    mockStore.currentChapter.value = { id: 'ch_1', title: 'Prologue' };

    // Rename event non-matching ID
    document.dispatchEvent(
      new CustomEvent('ww:chapter-renamed', {
        detail: { id: 'other_id', title: 'Ignored' },
      })
    );
    expect(mockStore.currentChapter.value.title).toBe('Prologue');

    // Rename event matching ID but same title
    document.dispatchEvent(
      new CustomEvent('ww:chapter-renamed', {
        detail: { id: 'ch_1', title: 'Prologue' },
      })
    );

    // Rename event matching ID with new title
    document.dispatchEvent(
      new CustomEvent('ww:chapter-renamed', {
        detail: { id: 'ch_1', title: 'Updated Prologue' },
      })
    );
    expect(mockStore.currentChapter.value.title).toBe('Updated Prologue');

    wrapper.unmount();
  });

  it('handles watcher branches for controlledChapterId and activeTreeNode', async () => {
    const reactiveProps = reactive<{
      project: string;
      controlledChapterId?: string;
      activeTreeNode: any;
    }>({
      project: 'proj_1',
      controlledChapterId: 'ch_1',
      activeTreeNode: { type: 'chapter', node: { id: 'ch_1' } } as any,
    });

    const main = useChaptersMain(reactiveProps, emit);

    // Same controlledChapterId (no-op)
    reactiveProps.controlledChapterId = 'ch_1';
    await nextTick();

    // Different controlledChapterId
    reactiveProps.controlledChapterId = 'ch_2';
    await nextTick();
    expect(mockStore.openChapter).toHaveBeenCalledWith('proj_1', 'ch_2');

    // Clear activeTreeNode without controlledChapterId
    reactiveProps.controlledChapterId = undefined;
    reactiveProps.activeTreeNode = null;
    await nextTick();
    expect(main.localActiveTreeNode.value).toBeUndefined();
    expect(mockStore.currentChapter.value).toBeNull();
    expect(mockStore.currentChapterId.value).toBeUndefined();
  });

  it('marks unsaved and triggers autosave debounce', () => {
    const main = useChaptersMain(props, emit);

    main.markUnsaved();
    expect(main.hasUnsavedChanges.value).toBe(true);
    expect(emit).toHaveBeenCalledWith('chapter-unsaved');

    vi.advanceTimersByTime(2000);
    expect(mockStore.saveChapter).toHaveBeenCalledWith('proj_1', emit);
  });

  it('handles tree node selection and opening chapter as tab', () => {
    const main = useChaptersMain(props, emit);

    main.onTreeNodeSelect({ type: 'volume', node: { id: 'vol_1' } });
    expect(main.localActiveTreeNode.value).toEqual({ type: 'volume', node: { id: 'vol_1' } });

    main.openChapterFromTree({ id: 'ch_2', title: 'Chapter 2' });
    expect(main.localActiveTreeNode.value).toEqual({
      type: 'chapter',
      node: { id: 'ch_2', title: 'Chapter 2' },
    });
    expect(emit).toHaveBeenCalledWith('open-chapter-as-tab', { id: 'ch_2', title: 'Chapter 2' });
  });

  it('creates and renames chapters with tree reload', async () => {
    const main = useChaptersMain(props, emit);
    const mockTree = { load: vi.fn().mockResolvedValue(undefined) };
    main.chapterTreeRef.value = mockTree;

    await main.createChapterIn({ volumeId: 'vol_1' });
    expect(mockStore.createNewChapter).toHaveBeenCalledWith('proj_1', 'vol_1');
    expect(mockTree.load).toHaveBeenCalled();

    await main.handleRenameChapter({ id: 'ch_1' } as any, 'New Name');
    expect(mockStore.onRenameChapter).toHaveBeenCalledWith('proj_1', { id: 'ch_1' }, 'New Name');
    expect(mockTree.load).toHaveBeenCalled();
  });

  it('handles chapter deletion (ignoring multi-select and deleting single)', async () => {
    const main = useChaptersMain(props, emit);
    const mockTree = { load: vi.fn().mockResolvedValue(undefined) };
    main.chapterTreeRef.value = mockTree;
    main.localActiveTreeNode.value = { type: 'chapter', node: { id: 'ch_1' } };

    // Multi-delete ignored
    main.handleDeleteChapter({ id: 'ch_1' }, true);
    expect(mockStore.deleteChapter).not.toHaveBeenCalled();

    // Single delete
    main.handleDeleteChapter({ id: 'ch_1' }, false);
    await Promise.resolve();

    expect(mockStore.deleteChapter).toHaveBeenCalledWith('proj_1', 'ch_1');
    expect(mockTree.load).toHaveBeenCalled();
    expect(main.localActiveTreeNode.value).toBeUndefined();
  });

  it('handles export, scroll change with null chapter and valid chapter', async () => {
    const main = useChaptersMain(props, emit);
    mockStore.currentChapter.value = { id: 'ch_1', scrollPos: 0 };

    await main.handleExport({
      chapterIds: ['ch_1', 'ch_2'],
      format: 'pdf',
      options: {
        addTOC: true,
        addPageNumbers: true,
        includeMetadata: true,
      },
    });
    expect(appAlert).toHaveBeenCalledWith('Начат экспорт 2 глав в формат pdf...');

    main.handleScrollChange(450);
    expect(mockStore.currentChapter.value.scrollPos).toBe(450);
    expect(emit).toHaveBeenCalledWith('scroll-change', 450);

    // With null current chapter
    mockStore.currentChapter.value = null;
    main.handleScrollChange(500);
    expect(emit).toHaveBeenCalledWith('scroll-change', 500);
  });

  it('runs onMounted, event listeners, and onUnmounted with controlledChapterId', async () => {
    const Component = defineComponent({
      props: ['project', 'controlledChapterId', 'activeTreeNode'],
      emits: ['chapter-unsaved', 'open-chapter-as-tab', 'scroll-change'],
      setup(p, { emit: e }) {
        return useChaptersMain(p as any, e as any);
      },
      template: '<div></div>',
    });

    const wrapper = mount(Component, {
      props: {
        project: 'proj_1',
        controlledChapterId: 'ch_ctrl',
        activeTreeNode: null,
      },
    });

    await flushPromises();
    expect(mockStore.openChapter).toHaveBeenCalledWith('proj_1', 'ch_ctrl');

    // Trigger markUnsaved twice to verify saveTimeout clearance
    const vm: any = wrapper.vm;
    vm.markUnsaved();
    vm.markUnsaved();
    expect(mockStore.hasUnsavedChanges.value).toBe(true);

    vi.advanceTimersByTime(2500);
    expect(mockStore.saveChapter).toHaveBeenCalled();

    // Trigger global events
    document.dispatchEvent(new CustomEvent('ww:trigger-chapter-save'));
    document.dispatchEvent(new CustomEvent('ww:hierarchy-changed'));
    document.dispatchEvent(new CustomEvent('ww:chapter-renamed', { detail: { id: 'ch_1', title: 'Renamed Global' } }));

    wrapper.unmount();

    // Mount without controlledChapterId
    const wrapperNoCtrl = mount(Component, {
      props: {
        project: 'proj_1',
        controlledChapterId: null,
        activeTreeNode: null,
      },
    });
    await flushPromises();
    wrapperNoCtrl.unmount();
  });

  it('handles handleAddParticipant and avoids duplicates', () => {
    const main = useChaptersMain(props, emit);
    mockStore.currentChapter.value = {
      id: 'ch_1',
      participants: [{ id: 'char_1', type: 'character' }],
    };

    // Add duplicate
    main.handleAddParticipant({ id: 'char_1', type: 'character' });
    expect(mockStore.currentChapter.value.participants).toHaveLength(1);

    // Add when currentChapter is null
    mockStore.currentChapter.value = null;
    expect(() => main.handleAddParticipant({ id: 'char_3', type: 'character' })).not.toThrow();
  });
});

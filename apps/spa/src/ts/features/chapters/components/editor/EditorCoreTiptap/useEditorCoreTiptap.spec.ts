import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useEditorCoreTiptap } from './useEditorCoreTiptap';
import type { EditorCoreTiptapProps, EditorCoreTiptapEmits } from './EditorCoreTiptap.model';

const mockEditorMode = ref<'wysiwyg' | 'markdown' | 'split'>('markdown');
const mockEditor = ref<unknown>(null);
const mockLocateScene = vi.fn();
const mockOpenEntityEditorWindow = vi.fn();
const mockDetectActiveEntityQuery = vi.fn();
const mockTiptapToSemanticAST = vi.fn(() => ({ id: 'doc-1', blocks: [] }));
const mockNormalizeSemanticDocument = vi.fn(() => ({ id: 'norm-1', blocks: [] }));

let capturedPromiseMenuOptions: Record<string, (payload: unknown) => void> = {};

vi.mock('./useTiptapEditor', () => ({
  useTiptapEditor: () => ({
    editor: mockEditor,
    editorMode: mockEditorMode,
    syncMarkdownFromEditor: vi.fn(),
    updateStats: vi.fn()
  })
}));

vi.mock('./composables/useEditorWordBridge', () => ({
  useEditorWordBridge: () => ({
    exportToWord: vi.fn()
  })
}));

vi.mock('./composables/useEditorSceneFrames', () => ({
  useEditorSceneFrames: () => ({
    locateScene: mockLocateScene
  })
}));

vi.mock('./composables/useEditorPromiseMenu', () => ({
  useEditorPromiseMenu: (opts: Record<string, (payload: unknown) => void>) => {
    capturedPromiseMenuOptions = opts;
    return {
      isPromiseMenuOpen: ref(false),
      promiseMenuPos: ref({ x: 0, y: 0 }),
      selectedPromiseData: ref({ quote: '', paragraph_index: 0 }),
      handleContextMenu: vi.fn(),
      handlePromiseSelect: vi.fn(),
      handleMilestoneSelect: vi.fn(),
      handleSubSceneSelect: vi.fn()
    };
  }
}));

vi.mock('@/services/document/ast/ASTAdapter', () => ({
  ASTAdapter: {
    tiptapToSemanticAST: (...args: unknown[]) => mockTiptapToSemanticAST(...args)
  }
}));

vi.mock('@/services/document/ast/ASTNormalizer', () => ({
  normalizeSemanticDocument: (...args: unknown[]) => mockNormalizeSemanticDocument(...args)
}));

vi.mock('@/utils/windowManager', () => ({
  openEntityEditorWindow: (...args: unknown[]) => mockOpenEntityEditorWindow(...args)
}));

vi.mock('@/services/Manuscript/manuscript.wasm-bridge', () => ({
  detectActiveEntityQuery: (...args: unknown[]) => mockDetectActiveEntityQuery(...args)
}));

describe('useEditorCoreTiptap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditorMode.value = 'markdown';
    mockEditor.value = null;
    capturedPromiseMenuOptions = {};
  });

  function mountCore(propsOverrides: Partial<EditorCoreTiptapProps> = {}) {
    const emitted: Array<{ event: string; args: unknown[] }> = [];
    const emit = ((event: string, ...args: unknown[]) => {
      emitted.push({ event, args });
    }) as unknown as EditorCoreTiptapEmits;

    let api!: ReturnType<typeof useEditorCoreTiptap>;

    const Comp = defineComponent({
      setup() {
        api = useEditorCoreTiptap(
          {
            project: 'proj-1',
            chapterId: 'ch-1',
            title: 'Глава 1',
            existingPromises: [],
            ...propsOverrides
          },
          emit
        );
        return () => h('div');
      }
    });

    const wrapper = mount(Comp, { attachTo: document.body });
    return { wrapper, api, emitted };
  }

  it('computes currentSemanticDocument with and without active tiptap editor', () => {
    const { wrapper, api } = mountCore();

    expect(api.currentSemanticDocument.value).toEqual({ id: 'norm-1', blocks: [] });
    expect(mockNormalizeSemanticDocument).toHaveBeenCalled();

    mockEditor.value = {
      getJSON: vi.fn(() => ({ type: 'doc', content: [] }))
    };
    expect(api.currentSemanticDocument.value).toEqual({ id: 'doc-1', blocks: [] });
    expect(mockTiptapToSemanticAST).toHaveBeenCalled();

    wrapper.unmount();
  });

  it('forwards promiseMenu callbacks to emits', () => {
    const { wrapper, emitted } = mountCore();

    capturedPromiseMenuOptions.onOpenPromiseCreateModal({
      quote: 'q1',
      paragraph_index: 1,
      block_id: 'b1',
      block_ids: ['b1']
    });
    capturedPromiseMenuOptions.onLinkMilestone({
      promiseId: 'p1',
      quote: 'q2',
      paragraph_index: 2
    });
    capturedPromiseMenuOptions.onLinkSubScene({
      parentPromiseId: 'p2',
      quote: 'q3',
      paragraph_index: 3
    });

    expect(emitted).toEqual([
      {
        event: 'create-promise',
        args: [{ kind: 'scene', quote: 'q1', paragraph_index: 1, block_id: 'b1', block_ids: ['b1'] }]
      },
      {
        event: 'link-milestone',
        args: [{ promiseId: 'p1', stage: 'progression', quote: 'q2', paragraph_index: 2, block_id: undefined, block_ids: undefined }]
      },
      {
        event: 'link-subscene',
        args: [{ parentPromiseId: 'p2', quote: 'q3', paragraph_index: 3, block_id: undefined, block_ids: undefined }]
      }
    ]);

    wrapper.unmount();
  });

  it('inserts entity link in markdown mode with and without active trigger', () => {
    const { wrapper, api, emitted } = mountCore();

    const textarea = document.createElement('textarea');
    textarea.value = 'Привет ((Ге)) мир';
    textarea.selectionStart = 11;
    textarea.selectionEnd = 11;
    api.setMarkdownTextarea(textarea);

    mockDetectActiveEntityQuery.mockReturnValue({ length: 4, query: 'Герой', isClosed: false });

    const docSpy = vi.spyOn(document, 'dispatchEvent');
    api.handleEntityInsert({ type: 'character', id: 'char:1', name: 'Герой' });

    expect(textarea.value).toContain('((Герой))[ui_editor.html?project=proj-1&type=character&id=char%3A1]');
    expect(emitted).toContainEqual({
      event: 'add-participant',
      args: [{ type: 'character', id: 'char:1', name: 'Герой' }]
    });
    expect(docSpy).toHaveBeenCalled();

    docSpy.mockRestore();
    wrapper.unmount();
  });

  it('inserts entity link in wysiwyg mode with and without active trigger', () => {
    mockEditorMode.value = 'wysiwyg';
    const run = vi.fn();
    const insertContent = vi.fn(() => ({ run }));
    const deleteRange = vi.fn(() => ({ insertContent }));
    const focus = vi.fn(() => ({ deleteRange, insertContent }));
    const chain = vi.fn(() => ({ focus }));

    mockEditor.value = {
      state: {
        selection: {
          $from: {
            pos: 10,
            parentOffset: 5,
            parent: { textBetween: vi.fn(() => '((Ал') }
          }
        }
      },
      chain
    };

    const { wrapper, api } = mountCore();
    api.activeEditorTarget.value = 'wysiwyg';

    mockDetectActiveEntityQuery.mockReturnValue({ length: 4, query: 'Алиса', isClosed: false });
    api.handleEntityInsert({ type: 'character', id: 'c1', name: 'Алиса' });
    expect(deleteRange).toHaveBeenCalledWith({ from: 6, to: 10 });
    expect(insertContent).toHaveBeenCalledWith('<a href="/ui_editor.html?project=proj-1&type=character&id=c1">Алиса</a>');

    mockDetectActiveEntityQuery.mockReturnValue(null);
    api.handleEntityInsert({ type: 'location', id: 'l1' });
    expect(insertContent).toHaveBeenCalledWith('<a href="/ui_editor.html?project=proj-1&type=location&id=l1">l1</a>');

    wrapper.unmount();
  });

  it('handles document events, global shortcuts, and helper methods', () => {
    const run = vi.fn();
    const insertContent = vi.fn(() => ({ run }));
    const focus = vi.fn(() => ({ insertContent }));
    mockEditor.value = { chain: vi.fn(() => ({ focus })) };

    const { wrapper, api } = mountCore();

    expect(api.getEditor()).toBe(mockEditor.value);
    api.openExportModal();
    expect(api.isExportModalOpen.value).toBe(true);

    document.dispatchEvent(
      new CustomEvent('ww:open-entity-selector', { detail: { target: 'wysiwyg', query: 'Маг' } })
    );
    expect(api.activeEditorTarget.value).toBe('wysiwyg');
    expect(api.entitySelectorQuery.value).toBe('Маг');
    expect(api.isEntitySelectorOpen.value).toBe(true);

    document.dispatchEvent(
      new CustomEvent('ww:open-entity-window', { detail: { type: 'character', id: 'character:hero' } })
    );
    expect(mockOpenEntityEditorWindow).toHaveBeenCalledWith('proj-1', 'character', 'character:hero', 'hero');

    document.dispatchEvent(
      new CustomEvent('ww:locate-promise', { detail: { paragraphIndex: 4, quote: 'q', blockId: 'b4' } })
    );
    expect(mockLocateScene).toHaveBeenCalledWith(4, 'q', 'b4');

    document.dispatchEvent(new CustomEvent('ww:locate-promise'));
    expect(mockLocateScene).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', altKey: true }));
    expect(insertContent).toHaveBeenCalledWith('$$f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2} dx$$');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
    expect(insertContent).toHaveBeenCalledWith('<hr class="page-break" />');

    wrapper.unmount();
  });
});


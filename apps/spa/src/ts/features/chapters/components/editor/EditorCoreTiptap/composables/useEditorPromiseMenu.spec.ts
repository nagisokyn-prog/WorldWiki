import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { Editor } from '@tiptap/vue-3';
import { useEditorPromiseMenu } from './useEditorPromiseMenu';
import type { PlotPromise } from '@/types/generated/PlotPromise';

describe('useEditorPromiseMenu', () => {
  const onOpenPromiseCreateModal = vi.fn();
  const onLinkMilestone = vi.fn();
  const onLinkSubScene = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockEditor(overrides: Record<string, unknown> = {}) {
    const doc = {
      textBetween: vi.fn(() => 'Выбранный текст'),
      forEach: vi.fn((cb: (node: unknown, offset: number, index: number) => void) => {
        cb({ nodeSize: 10, attrs: { id: 'blk-1' }, textContent: 'Первый абзац' }, 0, 0);
        cb({ nodeSize: 15, attrs: { id: 'blk-2' }, textContent: 'Второй абзац' }, 10, 1);
      }),
      resolve: vi.fn(() => ({
        parent: { textContent: 'Текст под курсором', attrs: { id: 'blk-cur' } },
        index: vi.fn(() => 1)
      }))
    };

    return {
      state: {
        selection: {
          empty: false,
          from: 5,
          to: 15
        },
        doc
      },
      view: {
        posAtCoords: vi.fn(() => ({ pos: 12 })),
        state: { doc }
      },
      ...overrides
    } as unknown as Editor;
  }

  it('opens menu with wysiwyg selection data and collects overlapping block ids', () => {
    const editorMode = ref<'wysiwyg' | 'markdown' | 'split'>('wysiwyg');
    const editor = ref<Editor | null>(createMockEditor());
    const markdownTextareaRef = ref<HTMLTextAreaElement | null>(null);

    const menu = useEditorPromiseMenu({
      editorMode,
      editor,
      markdownTextareaRef,
      onOpenPromiseCreateModal,
      onLinkMilestone,
      onLinkSubScene
    });

    const preventDefault = vi.fn();
    menu.handleContextMenu({
      clientX: 120,
      clientY: 240,
      preventDefault
    } as unknown as MouseEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(menu.isPromiseMenuOpen.value).toBe(true);
    expect(menu.promiseMenuPos.value).toEqual({ x: 120, y: 240 });
    expect(menu.selectedPromiseData.value.quote).toBe('Выбранный текст');
    expect(menu.selectedPromiseData.value.block_id).toBe('blk-1');
    expect(menu.selectedPromiseData.value.block_ids).toEqual(['blk-1', 'blk-2']);
  });

  it('resolves node at coords when wysiwyg selection is empty', () => {
    const editorMode = ref<'wysiwyg' | 'markdown' | 'split'>('split');
    const doc = {
      textBetween: vi.fn(() => ''),
      forEach: vi.fn((cb: (node: unknown, offset: number, index: number) => void) => {
        cb({ nodeSize: 10, attrs: { id: 'blk-1' }, textContent: 'Первый' }, 0, 0);
        cb({ nodeSize: 25, attrs: { id: 'blk-pos' }, textContent: 'Строка под курсором' }, 10, 1);
      }),
      resolve: vi.fn(() => ({
        parent: { textContent: 'Строка под курсором', attrs: { id: 'blk-pos' } },
        index: vi.fn(() => 2)
      }))
    };

    const editor = ref<Editor | null>(
      createMockEditor({
        state: {
          selection: { empty: true, from: 0, to: 0 },
          doc
        },
        view: {
          posAtCoords: vi.fn(() => ({ pos: 25 })),
          state: { doc }
        }
      })
    );
    const markdownTextareaRef = ref<HTMLTextAreaElement | null>(null);

    const menu = useEditorPromiseMenu({
      editorMode,
      editor,
      markdownTextareaRef,
      onOpenPromiseCreateModal,
      onLinkMilestone,
      onLinkSubScene
    });

    menu.handleContextMenu({
      clientX: 50,
      clientY: 60,
      preventDefault: vi.fn()
    } as unknown as MouseEvent);

    expect(menu.selectedPromiseData.value.quote).toBe('Строка под курсором');
    expect(menu.selectedPromiseData.value.paragraph_index).toBe(2);
    expect(menu.selectedPromiseData.value.block_id).toBe('blk-pos');
  });

  it('extracts selection and line fallback in markdown mode', () => {
    const editorMode = ref<'wysiwyg' | 'markdown' | 'split'>('markdown');
    const editor = ref<Editor | null>(null);
    const textarea = document.createElement('textarea');
    textarea.value = 'Первая строка\nВторая строка с текстом\nТретья';
    textarea.selectionStart = 14;
    textarea.selectionEnd = 27;
    const markdownTextareaRef = ref<HTMLTextAreaElement | null>(textarea);

    const menu = useEditorPromiseMenu({
      editorMode,
      editor,
      markdownTextareaRef,
      onOpenPromiseCreateModal,
      onLinkMilestone,
      onLinkSubScene
    });

    menu.handleContextMenu({
      clientX: 10,
      clientY: 20,
      preventDefault: vi.fn()
    } as unknown as MouseEvent);

    expect(menu.selectedPromiseData.value.quote).toBe('Вторая строка');
    expect(menu.selectedPromiseData.value.paragraph_index).toBe(2);

    // Empty selection in markdown falls back to current line
    textarea.selectionStart = 16;
    textarea.selectionEnd = 16;
    menu.handleContextMenu({
      clientX: 15,
      clientY: 25,
      preventDefault: vi.fn()
    } as unknown as MouseEvent);

    expect(menu.selectedPromiseData.value.quote).toBe('Первая строка');
  });

  it('falls back to window.getSelection or default quote when no editor/textarea selection', () => {
    const editorMode = ref<'wysiwyg' | 'markdown' | 'split'>('markdown');
    const editor = ref<Editor | null>(null);
    const markdownTextareaRef = ref<HTMLTextAreaElement | null>(null);

    const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => '  Цитата из окна  '
    } as unknown as Selection);

    const menu = useEditorPromiseMenu({
      editorMode,
      editor,
      markdownTextareaRef,
      onOpenPromiseCreateModal,
      onLinkMilestone,
      onLinkSubScene
    });

    menu.handleContextMenu({
      clientX: 1,
      clientY: 2,
      preventDefault: vi.fn()
    } as unknown as MouseEvent);
    expect(menu.selectedPromiseData.value.quote).toBe('Цитата из окна');

    getSelectionSpy.mockReturnValue({ toString: () => '   ' } as unknown as Selection);
    menu.handleContextMenu({
      clientX: 1,
      clientY: 2,
      preventDefault: vi.fn()
    } as unknown as MouseEvent);
    expect(menu.selectedPromiseData.value.quote).toBe('Сцена');

    getSelectionSpy.mockRestore();
  });

  it('handles promise create, milestone link, and subscene link callbacks', () => {
    const menu = useEditorPromiseMenu({
      editorMode: ref('markdown'),
      editor: ref(null),
      markdownTextareaRef: ref(null),
      onOpenPromiseCreateModal,
      onLinkMilestone,
      onLinkSubScene
    });

    menu.selectedPromiseData.value = {
      quote: 'Ключевая сцена',
      paragraph_index: 3,
      block_id: 'blk-3',
      block_ids: ['blk-3']
    };
    menu.isPromiseMenuOpen.value = true;

    menu.handlePromiseSelect({
      kind: 'gun',
      label: 'Чеховское ружьё',
      icon: '🔫',
      description: 'desc'
    });
    expect(menu.isPromiseMenuOpen.value).toBe(false);
    expect(onOpenPromiseCreateModal).toHaveBeenCalledWith({
      kind: 'gun',
      quote: 'Ключевая сцена',
      paragraph_index: 3,
      block_id: 'blk-3',
      block_ids: ['blk-3']
    });

    menu.handleMilestoneSelect({ promise: { id: '' } as PlotPromise, stage: 'progression' });
    expect(onLinkMilestone).not.toHaveBeenCalled();

    menu.handleMilestoneSelect({ promise: { id: 'p-1' } as PlotPromise, stage: 'resolution' });
    expect(onLinkMilestone).toHaveBeenCalledWith({
      promiseId: 'p-1',
      stage: 'resolution',
      quote: 'Ключевая сцена',
      paragraph_index: 3,
      block_id: 'blk-3',
      block_ids: ['blk-3']
    });

    menu.handleSubSceneSelect({ promise: { id: '' } as PlotPromise });
    expect(onLinkSubScene).not.toHaveBeenCalled();

    menu.handleSubSceneSelect({ promise: { id: 'p-2' } as PlotPromise });
    expect(onLinkSubScene).toHaveBeenCalledWith({
      parentPromiseId: 'p-2',
      quote: 'Ключевая сцена',
      paragraph_index: 3,
      block_id: 'blk-3',
      block_ids: ['blk-3']
    });
  });
});

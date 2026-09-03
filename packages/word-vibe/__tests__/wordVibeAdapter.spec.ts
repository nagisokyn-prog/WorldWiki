import { describe, it, expect, vi } from 'vitest';
import { createWordVibeAdapter } from '../src/adapter/createWordVibeAdapter';

// Мокируем rk-editor-core и tiptap-pagination-plus для изолированного тестирования адаптера
vi.mock('tiptap-pagination-plus', () => ({
  PaginationPlus: {
    configure: () => ({ name: 'PaginationPlus', options: {}, storage: {} }),
  },
}));

vi.mock('@raazkhnl/rk-editor-core', () => {
  class MockWordEditor {
    layout: Record<string, unknown>;
    instance: unknown;
    commands: Record<string, ReturnType<typeof vi.fn>>;
    setPageLayout: ReturnType<typeof vi.fn>;
    getPageLayout: ReturnType<typeof vi.fn>;
    getPageCount: ReturnType<typeof vi.fn>;
    exportDocx: ReturnType<typeof vi.fn>;
    printPdf: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    getHTML: ReturnType<typeof vi.fn>;
    setDocument: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;

    constructor(options: { pageLayout?: Record<string, unknown>; initialContent?: string }) {
      this.layout = options.pageLayout || { pageSize: 'A4', orientation: 'portrait' };
      const chainObj = {
        focus: () => chainObj,
        run: () => true,
        updateAttributes: () => chainObj,
        updatePageWidth: () => chainObj,
        updatePageHeight: () => chainObj,
        updateMargins: () => chainObj,
        updateHeaderContent: () => chainObj,
        updateFooterContent: () => chainObj,
        addRowBefore: () => chainObj,
        addRowAfter: () => chainObj,
        addColumnBefore: () => chainObj,
        addColumnAfter: () => chainObj,
        deleteRow: () => chainObj,
        deleteColumn: () => chainObj,
        deleteTable: () => chainObj,
        mergeCells: () => chainObj,
        splitCell: () => chainObj,
      };

      this.commands = {
        bold: vi.fn(),
        italic: vi.fn(),
        underline: vi.fn(),
        strike: vi.fn(),
        heading: vi.fn(),
        align: vi.fn(),
        spacing: vi.fn(),
        fontFamily: vi.fn(),
        fontSize: vi.fn(),
        lineHeight: vi.fn(),
        indent: vi.fn(),
        outdent: vi.fn(),
        pageBreak: vi.fn(),
        insertImage: vi.fn(),
        insertTable: vi.fn(),
        insertLink: vi.fn(),
        footnote: vi.fn(),
        insertMathBlock: vi.fn(),
        insertTableOfContents: vi.fn(),
        insertTextBox: vi.fn(),
        sectionBreak: vi.fn(),
        clearFormatting: vi.fn(),
        setTableStyle: vi.fn(),
        updatePageWidth: vi.fn(),
      };

      this.instance = {
        chain: () => chainObj,
        isActive: vi.fn(() => false),
        state: { selection: { empty: true, $from: { depth: 0 } } },
        commands: this.commands,
        getHTML: vi.fn(() => options.initialContent || '<p></p>'),
        options: {
          element: document.createElement('div'),
          extensions: [],
        },
      };

      this.setPageLayout = vi.fn((l) => { this.layout = l; });
      this.getPageLayout = vi.fn(() => this.layout);
      this.getPageCount = vi.fn(() => 1);
      this.exportDocx = vi.fn(async () => {});
      this.printPdf = vi.fn();
      this.destroy = vi.fn();
      this.getHTML = vi.fn(() => options.initialContent || '<p></p>');
      this.setDocument = vi.fn();
      this.focus = vi.fn();
    }
  }

  return { WordEditor: MockWordEditor };
});

describe('WordVibeAdapter Public Boundary', () => {
  it('1. Монтирует редактор и переходит в статус isReady() === true', () => {
    const adapter = createWordVibeAdapter();
    expect(adapter.isReady()).toBe(false);

    const host = document.createElement('div');
    const onMounted = vi.fn();
    const onReady = vi.fn();

    adapter.on('mounted', onMounted);
    adapter.on('ready', onReady);

    adapter.mount({
      host,
      initialContent: '<p>Привет, мир</p>',
      initialLayout: { pageSize: 'A4', orientation: 'portrait' },
    });

    expect(adapter.isReady()).toBe(true);
    expect(onMounted).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('2. Исполняет команды через execCommand без раскрытия внутренних объектов', () => {
    const adapter = createWordVibeAdapter();
    const host = document.createElement('div');
    adapter.mount({ host });

    expect(adapter.execCommand('toggleBold')).toBe(true);
    expect(adapter.execCommand('toggleItalic')).toBe(true);
    expect(adapter.execCommand('setHeading', 2)).toBe(true);
    expect(adapter.execCommand('setTextAlign', 'justify')).toBe(true);
    expect(adapter.execCommand('setParagraphSpacing', 0, 6)).toBe(true);
    expect(adapter.execCommand('unknown_command')).toBe(false);
  });

  it('3. Предоставляет список зарегистрированных команд через getCommandNames()', () => {
    const adapter = createWordVibeAdapter();
    const names = adapter.getCommandNames();

    expect(names).toContain('toggleBold');
    expect(names).toContain('setHeading');
    expect(names).toContain('insertTableWithCaption');
    expect(names).toContain('insertImageWithCaption');
    expect(names).toContain('insertSectionLandscape');
    expect(names).toContain('setGostMargins');
  });

  it('4. Управляет геометрией страницы и колонтитулами', () => {
    const adapter = createWordVibeAdapter();
    const host = document.createElement('div');
    const onLayoutChange = vi.fn();

    adapter.on('layout-change', onLayoutChange);
    adapter.mount({ host });

    adapter.setLayout({ orientation: 'landscape', pageSize: 'A3' });
    const layout = adapter.getLayout();

    expect(layout.orientation).toBe('landscape');
    expect(layout.pageSize).toBe('A3');
    expect(onLayoutChange).toHaveBeenCalled();
  });

  it('5. Возвращает WordSelectionDTO без утечки ProseMirror типов', () => {
    const adapter = createWordVibeAdapter();
    const host = document.createElement('div');
    adapter.mount({ host });

    const sel = adapter.getSelection();
    expect(sel).not.toBeNull();
    expect(sel).toHaveProperty('empty');
    expect(sel).toHaveProperty('isInsideTable');
    expect(sel).toHaveProperty('firstLineIndentCm');
    expect(sel).toHaveProperty('leftIndentCm');
  });

  it('6. unmount корректно сбрасывает состояние и эмитит destroyed', () => {
    const adapter = createWordVibeAdapter();
    const host = document.createElement('div');
    const onDestroyed = vi.fn();

    adapter.on('destroyed', onDestroyed);
    adapter.mount({ host });
    expect(adapter.isReady()).toBe(true);

    adapter.unmount();
    expect(adapter.isReady()).toBe(false);
    expect(onDestroyed).toHaveBeenCalledTimes(1);
  });

  it('7. Загружает и возвращает Semantic AST через loadDocument и getDocument', () => {
    const adapter = createWordVibeAdapter();
    const host = document.createElement('div');
    adapter.mount({ host });

    const doc = {
      id: 'doc-ast-test',
      metadata: { title: 'Документ AST' },
      profileId: 'gost',
      blocks: [
        {
          type: 'paragraph' as const,
          id: 'p-1',
          content: [{ type: 'text' as const, text: 'Тестовый текст AST' }],
        },
      ],
    };

    adapter.loadDocument(doc);
    const retrieved = adapter.getDocument();

    expect(retrieved.id).toBe('doc-ast-test');
    expect(retrieved.metadata.title).toBe('Документ AST');
    expect(retrieved.blocks).toBeDefined();
  });
});

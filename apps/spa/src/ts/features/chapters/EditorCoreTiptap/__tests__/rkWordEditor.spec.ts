import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { useRkWordEditor } from '../WordMode/useRkWordEditor';

// Мокируем @raazkhnl/rk-editor-core для модульного тестирования логики композабла
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

    constructor(options: { pageLayout?: Record<string, unknown> }) {
      this.layout = options.pageLayout || { pageSize: 'A4', orientation: 'portrait' };
      this.instance = {
        chain: () => ({
          focus: () => ({
            run: () => true,
            setParagraphIndent: () => ({ run: () => true }),
          }),
        }),
        isActive: vi.fn(() => false),
      };
      this.commands = {
        bold: vi.fn(),
        italic: vi.fn(),
        underline: vi.fn(),
        strike: vi.fn(),
        subscript: vi.fn(),
        superscript: vi.fn(),
        setHighlight: vi.fn(),
        heading: vi.fn(),
        blockquote: vi.fn(),
        bulletList: vi.fn(),
        orderedList: vi.fn(),
        align: vi.fn(),
        fontFamily: vi.fn(),
        fontSize: vi.fn(),
        lineHeight: vi.fn(),
        indent: vi.fn(),
        outdent: vi.fn(),
        pageBreak: vi.fn(),
        insertImage: vi.fn(),
        insertTable: vi.fn(),
        insertCaption: vi.fn(),
        insertLink: vi.fn(),
        footnote: vi.fn(),
        insertMathBlock: vi.fn(),
        clearFormatting: vi.fn(),
      };
      this.setPageLayout = vi.fn((newLayout: Record<string, unknown>) => {
        this.layout = { ...this.layout, ...newLayout };
      });
      this.getPageLayout = vi.fn(() => this.layout);
      this.getPageCount = vi.fn(() => 2);
      this.exportDocx = vi.fn().mockResolvedValue(undefined);
      this.printPdf = vi.fn();
      this.destroy = vi.fn();
    }
  }

  return {
    WordEditor: MockWordEditor,
  };
});

describe('RK Word Editor Composable & First-Class Orientation', () => {
  it('1. Корректно инициализирует начальные параметры книжной ориентации А4', () => {
    const hostRef = ref<HTMLElement | null>(document.createElement('div'));
    const emit = vi.fn();
    const props = {
      content: '<p>Привет мир</p>',
      chapterTitle: 'Тестовая глава',
    };

    const {
      orientation,
      pageSize,
      isLandscape,
      pageWidthPx,
      ribbonCommands,
    } = useRkWordEditor(hostRef, props, emit);

    expect(orientation.value).toBe('portrait');
    expect(pageSize.value).toBe('A4');
    expect(isLandscape.value).toBe(false);
    expect(pageWidthPx.value).toBe(794); // А4 Книжная: 794px

    // Проверяем наличие ключевых команд ленты
    expect(ribbonCommands.value.toggleBold).toBeDefined();
    expect(ribbonCommands.value.togglePageOrientation).toBeDefined();
    expect(ribbonCommands.value.setPageSize).toBeDefined();
  });

  it('2. Переключает ориентацию на Альбомную (Landscape) и расширяет ширину до 1123px', () => {
    const hostRef = ref<HTMLElement | null>(document.createElement('div'));
    const emit = vi.fn();
    const props = {
      content: '<p>Широкая таблица</p>',
      initialOrientation: 'portrait' as const,
    };

    const {
      orientation,
      isLandscape,
      pageWidthPx,
      toggleOrientation,
    } = useRkWordEditor(hostRef, props, emit);

    // Переключаем в альбомную ориентацию
    toggleOrientation();

    expect(orientation.value).toBe('landscape');
    expect(isLandscape.value).toBe(true);
    expect(pageWidthPx.value).toBe(1123); // А4 Альбомная: 1123px

    // Возвращаем в книжную
    toggleOrientation();

    expect(orientation.value).toBe('portrait');
    expect(isLandscape.value).toBe(false);
    expect(pageWidthPx.value).toBe(794);
  });

  it('3. Корректно пересчитывает ширину для других форматов бумаги (А5 и А3)', () => {
    const hostRef = ref<HTMLElement | null>(document.createElement('div'));
    const emit = vi.fn();
    const props = {
      content: '<p>Форматы книги</p>',
    };

    const {
      pageWidthPx,
      setPageSize,
      setOrientation,
    } = useRkWordEditor(hostRef, props, emit);

    // Книжный формат А5 (карманная книга)
    setPageSize('A5');
    setOrientation('portrait');
    expect(pageWidthPx.value).toBe(559);

    // Альбомный формат А5
    setOrientation('landscape');
    expect(pageWidthPx.value).toBe(794);

    // Большой чертежный формат А3
    setPageSize('A3');
    setOrientation('portrait');
    expect(pageWidthPx.value).toBe(1123);

    setOrientation('landscape');
    expect(pageWidthPx.value).toBe(1587);
  });

  it('4. Вызовы команд ленты WordRibbonBar транслируются в методы движка WordEditor', () => {
    const hostRef = ref<HTMLElement | null>(document.createElement('div'));
    const emit = vi.fn();
    const props = {
      content: '<p>Тест команд</p>',
    };

    const {
      wordEditor,
      ribbonCommands,
    } = useRkWordEditor(hostRef, props, emit);

    // Имитируем нажатие кнопок на ленте
    ribbonCommands.value.toggleBold?.();
    ribbonCommands.value.toggleItalic?.();
    ribbonCommands.value.toggleUnderline?.();
    ribbonCommands.value.insertPageBreak?.();
    ribbonCommands.value.setTextAlign?.('justify');

    expect(wordEditor.value?.commands.bold).toHaveBeenCalled();
    expect(wordEditor.value?.commands.italic).toHaveBeenCalled();
    expect(wordEditor.value?.commands.underline).toHaveBeenCalled();
    expect(wordEditor.value?.commands.pageBreak).toHaveBeenCalled();
    expect(wordEditor.value?.commands.align).toHaveBeenCalledWith('justify');
  });

  it('5. Вызов экспорта в DOCX и печати в PDF делегируется движку RK Word Editor', async () => {
    const hostRef = ref<HTMLElement | null>(document.createElement('div'));
    const emit = vi.fn();
    const props = {
      content: '<p>Экспорт документа</p>',
      chapterTitle: 'Отчет_ГОСТ',
    };

    const {
      wordEditor,
      exportDocx,
      printPdf,
    } = useRkWordEditor(hostRef, props, emit);

    await exportDocx();
    expect(wordEditor.value?.exportDocx).toHaveBeenCalled();

    printPdf();
    expect(wordEditor.value?.printPdf).toHaveBeenCalled();
  });

  it('6. Корректно мапит формат B5 и пересчитывает ширину страницы', () => {
    const hostRef = ref<HTMLElement | null>(document.createElement('div'));
    const emit = vi.fn();
    const props = {
      content: '<p>Формат B5</p>',
    };

    const {
      pageWidthPx,
      setPageSize,
      setOrientation,
    } = useRkWordEditor(hostRef, props, emit);

    setPageSize('B5');
    setOrientation('portrait');
    expect(pageWidthPx.value).toBe(665);

    setOrientation('landscape');
    expect(pageWidthPx.value).toBe(945);
  });
});

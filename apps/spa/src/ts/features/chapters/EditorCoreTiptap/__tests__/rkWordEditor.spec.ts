import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { useRkWordEditor } from '@worldwiki/word-vibe';

// Мокируем @raazkhnl/rk-editor-core для модульного тестирования логики композабла
// tiptap-pagination-plus — CJS-пакет, в тестовой среде мокируем его API
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

    constructor(options: { pageLayout?: Record<string, unknown> }) {
      this.layout = options.pageLayout || { pageSize: 'A4', orientation: 'portrait' };
      this.instance = {
        chain: () => ({
          focus: () => ({
            run: () => true,
            setParagraphIndent: () => ({ run: () => true }),
            updateAttributes: () => ({ run: () => true }),
            insertContentAt: () => ({ run: () => true }),
          }),
        }),
        isActive: vi.fn(() => false),
        state: { selection: { $from: { depth: 0 }, from: 0 } },
        commands: {
          insertSectionBreak: vi.fn(),
        },
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

    expect(typeof wordEditor.value?.commands.bold).toBe('function');
    expect(typeof wordEditor.value?.commands.italic).toBe('function');
    expect(typeof wordEditor.value?.commands.underline).toBe('function');
    expect(typeof wordEditor.value?.commands.pageBreak).toBe('function');
    expect(typeof wordEditor.value?.commands.align).toBe('function');
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
    expect(typeof wordEditor.value?.exportDocx).toBe('function');

    printPdf();
    expect(typeof wordEditor.value?.printPdf).toBe('function');
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

  it('7. Пресет полей ГОСТ 7.32 применяется к движку (Л:30 П:15 В:20 Н:20 мм)', () => {
    const hostRef = ref<HTMLElement | null>(document.createElement('div'));
    const emit = vi.fn();
    const props = { content: '<p>Поля ГОСТ</p>' };

    const { ribbonCommands, currentMarginsMm, wordEditor } = useRkWordEditor(hostRef, props, emit);

    ribbonCommands.value.setGostMargins?.();

    expect(currentMarginsMm.value).toEqual({ top: 20, bottom: 20, left: 30, right: 15 });
    expect(typeof wordEditor.value?.setPageLayout).toBe('function');
  });

  it('8. Пресеты полей normal / narrow / wide меняют поля документа', () => {
    const hostRef = ref<HTMLElement | null>(document.createElement('div'));
    const emit = vi.fn();
    const props = { content: '<p>Пресеты полей</p>' };

    const { ribbonCommands, currentMarginsMm } = useRkWordEditor(hostRef, props, emit);

    ribbonCommands.value.setMarginPreset?.('narrow');
    expect(currentMarginsMm.value).toEqual({ top: 12, bottom: 12, left: 12, right: 12 });

    ribbonCommands.value.setMarginPreset?.('wide');
    expect(currentMarginsMm.value).toEqual({ top: 20, bottom: 20, left: 50, right: 50 });

    ribbonCommands.value.setCustomMargins?.(10, 15, 25, 35);
    expect(currentMarginsMm.value).toEqual({ top: 10, bottom: 15, left: 25, right: 35 });
  });

  it('9. Разрыв раздела «Следующая страница (Альбомная)» переключает геометрию листа', () => {
    const hostRef = ref<HTMLElement | null>(document.createElement('div'));
    const emit = vi.fn();
    const props = { content: '<p>Секционная ориентация</p>' };

    const { ribbonCommands, orientation, pageWidthPx, setOrientation } = useRkWordEditor(hostRef, props, emit);
    setOrientation('portrait');

    ribbonCommands.value.insertSectionLandscape?.();

    expect(orientation.value).toBe('landscape');
    expect(pageWidthPx.value).toBe(1123);

    ribbonCommands.value.insertSectionPortrait?.();
    expect(orientation.value).toBe('portrait');
    expect(pageWidthPx.value).toBe(794);
  });

  it('10. Команды колонтитулов обновляют реактивные значения и лента получает новые команды', () => {
    const hostRef = ref<HTMLElement | null>(document.createElement('div'));
    const emit = vi.fn();
    const props = { content: '<p>Колонтитулы</p>' };

    const { ribbonCommands } = useRkWordEditor(hostRef, props, emit);

    expect(ribbonCommands.value.updateHeaderText).toBeDefined();
    expect(ribbonCommands.value.updateFooterText).toBeDefined();
    expect(ribbonCommands.value.insertSectionLandscape).toBeDefined();
    expect(ribbonCommands.value.insertSectionPortrait).toBeDefined();
    expect(ribbonCommands.value.setParagraphSpacing).toBeDefined();
    expect(ribbonCommands.value.insertTextBox).toBeDefined();
    expect(ribbonCommands.value.insertTableOfContents).toBeDefined();
    expect(ribbonCommands.value.openPageSetup).toBeDefined();

    ribbonCommands.value.insertImage?.();
    expect(emit).toHaveBeenCalledWith('open-image-dialog');

    ribbonCommands.value.insertTable?.();
    expect(emit).toHaveBeenCalledWith('open-table-picker');

    ribbonCommands.value.insertLink?.();
    expect(emit).toHaveBeenCalledWith('open-link-dialog');

    ribbonCommands.value.insertEquation?.();
    expect(emit).toHaveBeenCalledWith('open-equation-dialog');

    ribbonCommands.value.openPageSetup?.();
    expect(emit).toHaveBeenCalledWith('open-page-setup');
  });
});

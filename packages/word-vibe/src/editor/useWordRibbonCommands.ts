import { computed, type ShallowRef } from 'vue';
import type { WordEditor } from '@raazkhnl/rk-editor-core';
import type { EditorInstance, PageSize, Orientation, RkWordEditorEmits } from './RkWordEditor.model';
import type { RibbonCommands } from '../ribbon/commands';
import type { MarginPresetName } from './useWordLayoutState';
import { insertGostTableCaption } from './extensions/GostTableCaption';
import { insertGostFigureCaption } from './extensions/GostFigureCaption';
import { insertSectionLandscape, insertSectionPortrait } from './extensions/SectionOrientation';
import { EDITOR_DEFAULT_COLORS } from '../tokens/editor.tokens';

interface ChainRunner {
  focus: () => ChainRunner;
  updateAttributes: (name: string, attrs: Record<string, unknown>) => ChainRunner;
  addRowBefore?: () => ChainRunner;
  addRowAfter?: () => ChainRunner;
  addColumnBefore?: () => ChainRunner;
  addColumnAfter?: () => ChainRunner;
  deleteRow?: () => ChainRunner;
  deleteColumn?: () => ChainRunner;
  deleteTable?: () => ChainRunner;
  mergeCells?: () => ChainRunner;
  splitCell?: () => ChainRunner;
  run: () => boolean;
}

export interface UseWordRibbonCommandsContext {
  wordEditor: ShallowRef<WordEditor | null>;
  tiptapEditor: ShallowRef<EditorInstance | null>;
  emit: RkWordEditorEmits;
  setOrientation: (o: Orientation) => void;
  toggleOrientation: () => void;
  setPageSize: (s: PageSize) => void;
  setMarginPreset: (preset: MarginPresetName) => void;
  setCustomMargins: (top: number, bottom: number, left: number, right: number) => void;
}

export function useWordRibbonCommands(ctx: UseWordRibbonCommandsContext) {
  const PX_PER_CM = 37.82;
  const INDENT_STEP_PX = 40;

  type CommandFn = (...args: unknown[]) => boolean | void;

  const cmd = (): Record<string, CommandFn> | undefined => {
    const wrapper = ctx.wordEditor.value as unknown as { instance?: unknown } | null;
    if (wrapper && wrapper.instance === ctx.tiptapEditor.value && ctx.wordEditor.value) {
      return ctx.wordEditor.value.commands as unknown as Record<string, CommandFn>;
    }
    return (ctx.tiptapEditor.value as unknown as { commands?: Record<string, CommandFn> })?.commands;
  };

  const ribbonCommands = computed<RibbonCommands>(() => ({
    toggleBold: () => cmd()?.bold(),
    toggleItalic: () => cmd()?.italic(),
    toggleUnderline: () => cmd()?.underline(),
    toggleStrike: () => cmd()?.strike(),
    toggleSubscript: () => cmd()?.subscript(),
    toggleSuperscript: () => cmd()?.superscript(),
    toggleHighlight: () => cmd()?.setHighlight(EDITOR_DEFAULT_COLORS.highlight),
    setHeading: (lvl: number) => cmd()?.heading(lvl as 1 | 2 | 3 | 4 | 5 | 6),
    toggleBlockquote: () => cmd()?.blockquote(),
    toggleBulletList: () => cmd()?.bulletList(),
    toggleOrderedList: () => cmd()?.orderedList(),
    setTextAlign: (align: 'left' | 'center' | 'right' | 'justify') => cmd()?.align(align),
    setFontFamily: (font: string) => cmd()?.fontFamily(font),
    setFontSize: (size: string) => cmd()?.fontSize(size),
    setLineHeight: (height: string) => cmd()?.lineHeight(height),
    decreaseIndent: () => cmd()?.outdent(),
    increaseIndent: () => cmd()?.indent(),
    insertPageBreak: () => cmd()?.pageBreak(),
    insertImage: () => ctx.emit('open-image-dialog'),
    insertImageWithCaption: (src: string, caption?: string) => {
      cmd()?.insertImage(src);
      insertGostFigureCaption(ctx.tiptapEditor.value, caption);
    },
    insertTable: () => ctx.emit('open-table-picker'),
    insertTableWithCaption: (rows: number, cols: number, title?: string) => {
      cmd()?.insertTable({ rows, cols, withHeaderRow: true });
      insertGostTableCaption(ctx.tiptapEditor.value, title);
    },
    insertLink: () => ctx.emit('open-link-dialog'),
    insertLinkUrl: (url: string) => cmd()?.insertLink(url),
    insertFootnote: () => cmd()?.footnote(),
    insertEquation: () => ctx.emit('open-equation-dialog'),
    insertEquationLatex: (latex: string) => cmd()?.insertMathBlock(latex),
    insertTableOfContents: () => cmd()?.insertTableOfContents({ minLevel: 1, maxLevel: 3, title: 'Содержание', showPageNumbers: true }),
    insertTextBox: () => cmd()?.insertTextBox(),
    insertSectionBreak: () => cmd()?.sectionBreak?.(),
    insertSectionLandscape: () => {
      insertSectionLandscape(ctx.tiptapEditor.value, (o) => ctx.setOrientation(o));
    },
    insertSectionPortrait: () => {
      insertSectionPortrait(ctx.tiptapEditor.value, (o) => ctx.setOrientation(o));
    },
    clearFormatting: () => cmd()?.clearFormatting(),
    togglePageOrientation: () => ctx.toggleOrientation(),
    setPageSize: (size: string) => ctx.setPageSize(size as PageSize),
    setGostMargins: () => ctx.setMarginPreset('gost'),
    setMarginPreset: (preset: string) => ctx.setMarginPreset(preset as MarginPresetName),
    setCustomMargins: (top: number, bottom: number, left: number, right: number) =>
      ctx.setCustomMargins(top, bottom, left, right),
    setParagraphSpacing: (beforePt: number, afterPt: number) =>
      cmd()?.spacing(`${beforePt}pt`, `${afterPt}pt`),
    setLeftIndentCm: (cm: number) => {
      const level = Math.max(0, Math.min(8, Math.round((cm * PX_PER_CM) / INDENT_STEP_PX)));
      (ctx.tiptapEditor.value?.chain() as unknown as ChainRunner | undefined)?.focus().updateAttributes('paragraph', { indent: level }).run();
    },
    setRightIndentCm: (_cm: number) => {
      // Right indent via paragraph attrs
    },
    setFirstLineIndentCm: (cm: number) => {
      const val = cm <= 0 ? '0' : `${cm.toFixed(3)}cm`;
      (ctx.tiptapEditor.value?.chain() as unknown as ChainRunner | undefined)?.focus().updateAttributes('paragraph', { firstLineIndent: val }).run();
    },
    openHeaderFooterDialog: (tab?: 'header' | 'footer') =>
      ctx.emit('open-header-footer-dialog', tab),
    openFontDialog: () => ctx.emit('open-font-dialog'),
    openParagraphDialog: () => ctx.emit('open-paragraph-dialog'),
    openPageSetupDialog: () => ctx.emit('open-page-setup'),
    addRowBefore: () => (ctx.tiptapEditor.value?.chain() as unknown as ChainRunner | undefined)?.focus().addRowBefore?.().run(),
    addRowAfter: () => (ctx.tiptapEditor.value?.chain() as unknown as ChainRunner | undefined)?.focus().addRowAfter?.().run(),
    addColumnBefore: () => (ctx.tiptapEditor.value?.chain() as unknown as ChainRunner | undefined)?.focus().addColumnBefore?.().run(),
    addColumnAfter: () => (ctx.tiptapEditor.value?.chain() as unknown as ChainRunner | undefined)?.focus().addColumnAfter?.().run(),
    deleteRow: () => (ctx.tiptapEditor.value?.chain() as unknown as ChainRunner | undefined)?.focus().deleteRow?.().run(),
    deleteColumn: () => (ctx.tiptapEditor.value?.chain() as unknown as ChainRunner | undefined)?.focus().deleteColumn?.().run(),
    deleteTable: () => (ctx.tiptapEditor.value?.chain() as unknown as ChainRunner | undefined)?.focus().deleteTable?.().run(),
    mergeCells: () => (ctx.tiptapEditor.value?.chain() as unknown as ChainRunner | undefined)?.focus().mergeCells?.().run(),
    splitCell: () => (ctx.tiptapEditor.value?.chain() as unknown as ChainRunner | undefined)?.focus().splitCell?.().run(),
    setTableStyle: (style: string) => cmd()?.setTableStyle(style),
  }));

  return {
    ribbonCommands,
  };
}

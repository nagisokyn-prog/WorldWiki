import type { Editor } from '@tiptap/core';
import type { PageSize, WordLayoutDTO, WordSelectionDTO } from '../types/dto';
import type { WordVibeEventMap } from './events';
import { MARGIN_PRESETS_MM } from '../editor/useRkWordEditor';
import { insertGostFigureCaption } from '../editor/extensions/GostFigureCaption';
import { insertGostTableCaption } from '../editor/extensions/GostTableCaption';
import { insertSectionLandscape, insertSectionPortrait } from '../editor/extensions/SectionOrientation';
import { PX_PER_CM, INDENT_STEP_PX, type WordEditorHost } from './createWordVibeSelection';
import { EDITOR_DEFAULT_COLORS } from '../tokens/editor.tokens';

interface ChainRunner {
  focus: () => ChainRunner;
  updateAttributes: (name: string, attrs: Record<string, unknown>) => ChainRunner;
  insertContent: (content: unknown) => ChainRunner;
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

type CommandFn = (...args: unknown[]) => boolean | void | unknown;

export interface CommandExecutionContext {
  activeTiptapEditor: Editor | null;
  wordEditor: unknown;
  currentLayout: WordLayoutDTO;
  setLayout: (layout: Partial<WordLayoutDTO>) => void;
  emit: <K extends keyof WordVibeEventMap>(
    event: K,
    ...args: WordVibeEventMap[K] extends void ? [] : [WordVibeEventMap[K]]
  ) => void;
  buildSelectionDTO: () => WordSelectionDTO;
}

export function executeWordVibeCommand(
  name: string,
  args: unknown[],
  ctx: CommandExecutionContext
): boolean {
  const ed = ctx.activeTiptapEditor || ((ctx.wordEditor as unknown as WordEditorHost)?.instance);
  const commands = (((ctx.wordEditor as unknown as WordEditorHost)?.commands) || (ed?.commands as unknown)) as Record<string, CommandFn> | undefined;
  const chain = ed?.chain() as unknown as ChainRunner | undefined;

  if (!ed && !commands) return false;

  try {
    if (ed && !ed.isFocused && !ed.state?.selection?.empty) {
      ed.commands?.focus?.();
    }
  } catch (err) {
    console.warn('[WordVibeCommands] Failed to focus editor before command execution:', err);
  }

  switch (name) {
    case 'toggleBold': commands?.bold?.(); return true;
    case 'toggleItalic': commands?.italic?.(); return true;
    case 'toggleUnderline': commands?.underline?.(); return true;
    case 'toggleStrike': commands?.strike?.(); return true;
    case 'toggleSubscript': commands?.subscript?.(); return true;
    case 'toggleSuperscript': commands?.superscript?.(); return true;
    case 'toggleHighlight': commands?.setHighlight?.(String(args[0] || EDITOR_DEFAULT_COLORS.highlight)); return true;
    case 'setHeading': commands?.heading?.(Number(args[0])); return true;
    case 'toggleBlockquote': commands?.blockquote?.(); return true;
    case 'toggleBulletList': commands?.bulletList?.(); return true;
    case 'toggleOrderedList': commands?.orderedList?.(); return true;
    case 'setTextAlign': commands?.align?.(args[0] as 'left' | 'center' | 'right' | 'justify'); return true;
    case 'setFontFamily': commands?.fontFamily?.(String(args[0])); return true;
    case 'setFontSize': commands?.fontSize?.(String(args[0])); return true;
    case 'setLineHeight': commands?.lineHeight?.(String(args[0])); return true;
    case 'decreaseIndent': commands?.outdent?.(); return true;
    case 'increaseIndent': commands?.indent?.(); return true;
    case 'setFirstLineIndent': {
      const cm = Number(args[0]) || 0;
      const val = cm <= 0 ? '0' : `${cm.toFixed(3)}cm`;
      chain?.focus()?.updateAttributes('paragraph', { firstLineIndent: val })?.run();
      ctx.emit('selection-change', ctx.buildSelectionDTO());
      return true;
    }
    case 'setLeftIndent': {
      const cm = Number(args[0]) || 0;
      const level = Math.max(0, Math.min(8, Math.round((cm * PX_PER_CM) / INDENT_STEP_PX)));
      chain?.focus()?.updateAttributes('paragraph', { indent: level })?.run();
      ctx.emit('selection-change', ctx.buildSelectionDTO());
      return true;
    }
    case 'insertPageBreak': commands?.pageBreak?.(); return true;
    case 'insertSceneBreak':
      chain?.focus()?.insertContent({ type: 'sceneBreak', attrs: { variant: args[0] || 'asterisms' } })?.run();
      return true;
    case 'insertEntityReference':
      chain?.focus()?.insertContent({
        type: 'entityReference',
        attrs: {
          id: args[0],
          entityType: args[1] || 'character',
          name: args[2] || 'Сущность',
          url: args[3],
        },
      })?.run();
      return true;
    case 'insertCrossReference':
      chain?.focus()?.insertContent({
        type: 'crossReference',
        attrs: {
          targetId: args[0],
          kind: args[1] || 'heading',
          displayMode: args[2] || 'full',
        },
      })?.run();
      return true;
    case 'insertImage': ctx.emit('open-image-dialog'); return true;
    case 'insertImageWithCaption': {
      const src = String(args[0]);
      const caption = args[1] ? String(args[1]) : undefined;
      commands?.insertImage?.(src);
      insertGostFigureCaption(ed, caption);
      return true;
    }
    case 'insertTable': ctx.emit('open-table-picker'); return true;
    case 'insertTableWithCaption': {
      const rows = Number(args[0]) || 2;
      const cols = Number(args[1]) || 2;
      const title = args[2] ? String(args[2]) : undefined;
      commands?.insertTable?.({ rows, cols, withHeaderRow: true });
      insertGostTableCaption(ed, title);
      return true;
    }
    case 'insertLink': ctx.emit('open-link-dialog'); return true;
    case 'insertLinkUrl': commands?.insertLink?.(String(args[0])); return true;
    case 'insertFootnote': commands?.footnote?.(); return true;
    case 'insertEquation': ctx.emit('open-equation-dialog'); return true;
    case 'insertEquationLatex': commands?.insertMathBlock?.(String(args[0])); return true;
    case 'insertTableOfContents': commands?.insertTableOfContents?.({ minLevel: 1, maxLevel: 3, title: 'Содержание', showPageNumbers: true }); return true;
    case 'insertTextBox': commands?.insertTextBox?.(); return true;
    case 'insertSectionBreak': commands?.sectionBreak?.(); return true;
    case 'insertSectionLandscape':
      insertSectionLandscape(ed, (o) => ctx.setLayout({ orientation: o }));
      return true;
    case 'insertSectionPortrait':
      insertSectionPortrait(ed, (o) => ctx.setLayout({ orientation: o }));
      return true;
    case 'clearFormatting': commands?.clearFormatting?.(); return true;
    case 'togglePageOrientation':
      ctx.setLayout({ orientation: ctx.currentLayout.orientation === 'portrait' ? 'landscape' : 'portrait' });
      return true;
    case 'setPageSize':
      ctx.setLayout({ pageSize: args[0] as PageSize });
      return true;
    case 'setMarginPreset': {
      const presetName = args[0] as keyof typeof MARGIN_PRESETS_MM;
      if (MARGIN_PRESETS_MM[presetName]) {
        ctx.setLayout({ marginsMm: { ...MARGIN_PRESETS_MM[presetName] } });
      }
      return true;
    }
    case 'setCustomMargins':
      ctx.setLayout({
        marginsMm: {
          top: Number(args[0]),
          bottom: Number(args[1]),
          left: Number(args[2]),
          right: Number(args[3]),
        },
      });
      return true;
    case 'setParagraphSpacing':
      commands?.spacing?.(`${String(args[0])}pt`, `${String(args[1])}pt`);
      return true;
    case 'addRowBefore': chain?.focus()?.addRowBefore?.()?.run(); return true;
    case 'addRowAfter': chain?.focus()?.addRowAfter?.()?.run(); return true;
    case 'addColumnBefore': chain?.focus()?.addColumnBefore?.()?.run(); return true;
    case 'addColumnAfter': chain?.focus()?.addColumnAfter?.()?.run(); return true;
    case 'deleteRow': chain?.focus()?.deleteRow?.()?.run(); return true;
    case 'deleteColumn': chain?.focus()?.deleteColumn?.()?.run(); return true;
    case 'deleteTable': chain?.focus()?.deleteTable?.()?.run(); return true;
    case 'mergeCells': chain?.focus()?.mergeCells?.()?.run(); return true;
    case 'splitCell': chain?.focus()?.splitCell?.()?.run(); return true;
    case 'setTableStyle':
      commands?.setTableStyle?.(String(args[0]));
      return true;
    default:
      console.warn(`[WordVibeAdapter] Unknown command: "${name}"`);
      return false;
  }
}

import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import type { EditorInstance, PaperSize, RibbonCommands } from '@worldwiki/word-vibe';

// Типы PaperSize и RibbonCommands теперь живут в @worldwiki/word-vibe (ЕДИНСТВЕННЫЙ источник)
export type { PaperSize, RibbonCommands };

export interface RibbonProps {
  editor: EditorInstance | null | undefined;
  commands: RibbonCommands;
  isInsideTable?: boolean;
}

export type RibbonEmit = <T extends 'open-paragraph-dialog' | 'open-font-dialog' | 'open-page-setup' | 'open-header-footer-dialog'>(
  e: T,
  ...args: unknown[]
) => void;

const RIBBON_DEBUG = true;
const rlog = (...args: unknown[]) => {
  if (RIBBON_DEBUG) console.log('%c[Ribbon]', 'color:#e91e63;font-weight:bold', ...args);
};

let selectionReporter: (() => void) | null = null;

function execCommand(name: string, fn: (() => unknown) | undefined) {
  rlog(`▶ execCommand('${name}') — fn:`, fn);
  selectionReporter?.();
  if (!fn) {
    console.error(`[Ribbon] ${name}: command is undefined`);
    return;
  }
  const t0 = performance.now();
  try {
    const result = fn();
    rlog(`✔ ${name} done in ${(performance.now() - t0).toFixed(1)}ms, result:`, result);
    return result;
  } catch (error) {
    console.error(`[Ribbon] ${name} failed:`, error);
    throw error;
  }
}

function describeCommands(commands: unknown): string {
  if (!commands || typeof commands !== 'object') return String(commands);
  const keys = Object.keys(commands as Record<string, unknown>);
  const fns = keys.filter(k => typeof (commands as Record<string, unknown>)[k] === 'function');
  const missing = keys.filter(k => typeof (commands as Record<string, unknown>)[k] !== 'function');
  return `commands: ${keys.length} keys, ${fns.length} functions [${fns.join(', ')}], non-functions [${missing.join(', ')}]`;
}

export function useWordRibbonBar(props: RibbonProps, _emit: RibbonEmit) {
  rlog('useWordRibbonBar() init, props.editor:', props.editor);
  rlog(' ', describeCommands(props.commands));
  if (typeof props.commands !== 'object' || props.commands === null) {
    console.error('[Ribbon] props.commands is NOT an object — кнопки не смогут работать. Значение:', props.commands);
  }

  watch(
    () => props.commands,
    (cmd) => {
      rlog('⚡ props.commands изменился:', cmd);
      rlog(' ', describeCommands(cmd));
    },
    { deep: true }
  );

  watch(
    () => props.editor,
    (ed) => rlog('⚡ props.editor изменился:', ed)
  );

  // Логирующий прокси поверх props.commands для шаблона: setup-биндинг `commands`
  // перекрывает проп, перехватывая ВСЕ прямые вызовы (в т.ч. (commands as any).xxx?.()).
  // Поведение не меняется — только логирование.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- используется шаблоном WordRibbonBar.vue (перекрывает проп `commands`)
  const commands = new Proxy({} as RibbonCommands, {
    get(_target, prop: string) {
      const cmd = props.commands?.[prop];
      if (typeof cmd === 'function') {
        return (...args: unknown[]) => {
          rlog(`▶ direct command '${prop}' args:`, args);
          const t0 = performance.now();
          try {
            const result = (cmd as (...a: unknown[]) => unknown).apply(props.commands, args);
            rlog(`✔ ${prop} done in ${(performance.now() - t0).toFixed(1)}ms, result:`, result);
            return result;
          } catch (error) {
            console.error(`[Ribbon] ${prop} failed:`, error);
            throw error;
          }
        };
      }
      rlog(`⚠ direct command '${prop}' is not a function:`, cmd);
      return cmd;
    },
  });
  // expose для шаблона (перекрывает проп `commands`)

  const activeTab = ref<'home' | 'insert' | 'layout' | 'table-design'>('home');
  const currentPageSize = ref<PaperSize>('A4');
  const currentFontFamily = ref("'Times New Roman', Times, serif");
  const currentFontSize = ref('14pt');
  const currentLineHeight = ref('1.5');
  const showInvisibles = ref(false);
  const openDropdown = ref<string | null>(null);
  const dropdownPos = ref({ top: 0, left: 0 });
  const indentLeftCm = ref(0);
  const indentRightCm = ref(0);
  const spacingBeforePt = ref(0);
  const spacingAfterPt = ref(0);

  const toggleDropdown = (event: MouseEvent, name: string) => {
    if (openDropdown.value === name) {
      openDropdown.value = null;
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dropdownPos.value = { top: rect.bottom + 4, left: rect.left };
    openDropdown.value = name;
  };

  const closeDropdown = () => {
    openDropdown.value = null;
  };

  const applyLeftIndent = () => execCommand('setLeftIndentCm', () => props.commands.setLeftIndentCm?.(Number(indentLeftCm.value) || 0));
  const applyRightIndent = () => execCommand('setRightIndentCm', () => props.commands.setRightIndentCm?.(Number(indentRightCm.value) || 0));
  const applySpacing = () => execCommand('setParagraphSpacing', () => props.commands.setParagraphSpacing?.(Number(spacingBeforePt.value) || 0, Number(spacingAfterPt.value) || 0));

  const applyHeaderPreset = (preset: 'empty' | 'chapter-left' | 'chapter-center') => {
    try {
      if (preset === 'empty') props.commands.updateHeaderText?.('', '');
      else if (preset === 'chapter-left') props.commands.updateHeaderText?.('Название главы', '');
      else props.commands.updateHeaderText?.('', 'Название главы');
      closeDropdown();
    } catch (error) {
      console.error('[Ribbon] applyHeaderPreset failed:', error);
      throw error;
    }
  };

  const applyFooterPreset = (preset: 'empty' | 'page-right' | 'page-center' | 'page-only-right') => {
    try {
      if (preset === 'empty') props.commands.updateFooterText?.('', '');
      else if (preset === 'page-right') props.commands.updateFooterText?.('', 'Стр. {page} из {total}');
      else if (preset === 'page-center') props.commands.updateFooterText?.('Стр. {page} из {total}', '');
      else props.commands.updateFooterText?.('', '{page}');
      closeDropdown();
    } catch (error) {
      console.error('[Ribbon] applyFooterPreset failed:', error);
      throw error;
    }
  };

  const applyPageNumberPosition = (position: string) => {
    try {
      props.commands.updateHeaderText?.('', '');
      props.commands.updateFooterText?.('', '');
      if (position === 'header-left') props.commands.updateHeaderText?.('{page}', '');
      else if (position === 'header-center') props.commands.updateHeaderText?.('', '{page}');
      else if (position === 'header-right') props.commands.updateHeaderText?.('', '{page}');
      else if (position === 'footer-left') props.commands.updateFooterText?.('{page}', '');
      else if (position === 'footer-center') props.commands.updateFooterText?.('{page}', '');
      else props.commands.updateFooterText?.('', '{page}');
      closeDropdown();
    } catch (error) {
      console.error('[Ribbon] applyPageNumberPosition failed:', error);
      throw error;
    }
  };

  const handleViewportChange = () => closeDropdown();

  // ===== АГРЕССИВНАЯ ДИАГНОСТИКА: выделение редактора и перехват мыши =====
  const describeSelection = (label: string) => {
    const ed = props.editor as unknown as { state?: { selection?: { empty: boolean; from: number; to: number } } } | null | undefined;
    const sel = ed?.state?.selection;
    const active = document.activeElement;
    const activeDesc = active ? `${active.tagName}${active.className ? '.' + String(active.className).split(' ').slice(0, 2).join('.') : ''}` : 'null';
    rlog(`🔎 ${label}: activeElement=${activeDesc}, selection=`, sel ? (sel.empty ? 'ПУСТО (выделение потеряно!)' : `from=${sel.from} to=${sel.to}`) : 'editor/state недоступен');
  };

  const isInsideRibbon = (el: EventTarget | null): boolean =>
    el instanceof Element && Boolean(el.closest('.word-ribbon'));

  const onMouseDownCapture = (e: MouseEvent) => {
    if (!isInsideRibbon(e.target)) return;
    rlog('🖱 mousedown (capture) на ленте, target:', e.target);
    describeSelection('ДО mousedown');
  };
  const onMouseUpCapture = (e: MouseEvent) => {
    if (!isInsideRibbon(e.target)) return;
    describeSelection('ПОСЛЕ mouseup (фокус/выделение должны сохраниться)');
  };
  const onClickCapture = (e: MouseEvent) => {
    if (!isInsideRibbon(e.target)) return;
    const btn = (e.target as Element).closest('button, select, [role=button]');
    rlog('👆 click (capture) на:', btn ? (btn.textContent || '').trim().slice(0, 40) || btn.className : e.target);
  };

  onMounted(() => {
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);
    // diagnostics
    document.addEventListener('mousedown', onMouseDownCapture, true);
    document.addEventListener('mouseup', onMouseUpCapture, true);
    document.addEventListener('click', onClickCapture, true);
    rlog('🩺 диагностика ленты установлена. props.editor:', props.editor);
    selectionReporter = () => describeSelection(`перед выполнением команды`);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', handleViewportChange, true);
    window.removeEventListener('resize', handleViewportChange);
    document.removeEventListener('mousedown', onMouseDownCapture, true);
    document.removeEventListener('mouseup', onMouseUpCapture, true);
    document.removeEventListener('click', onClickCapture, true);
  });

  const applyFontFamily = () => execCommand('setFontFamily', () => props.commands.setFontFamily?.(currentFontFamily.value));
  const applyFontSize = () => execCommand('setFontSize', () => props.commands.setFontSize?.(currentFontSize.value));
  const applyLineHeight = () => execCommand('setLineHeight', () => props.commands.setLineHeight?.(currentLineHeight.value));

  const stepFontSize = (delta: number) => {
    const currentNum = parseInt(currentFontSize.value, 10) || 14;
    const newNum = Math.max(8, Math.min(72, currentNum + delta * 2));
    currentFontSize.value = `${newNum}pt`;
    applyFontSize();
  };

  const toggleInvisibles = () => {
    showInvisibles.value = !showInvisibles.value;
    document.body.classList.toggle('show-invisibles', showInvisibles.value);
  };

  const call = (name: string, fn: (() => unknown) | undefined) => execCommand(name, fn);

  return {
    activeTab, currentPageSize, currentFontFamily, currentFontSize, currentLineHeight,
    showInvisibles, openDropdown, dropdownPos, indentLeftCm, indentRightCm,
    spacingBeforePt, spacingAfterPt, toggleDropdown, closeDropdown,
    applyLeftIndent, applyRightIndent, applySpacing, applyHeaderPreset,
    applyFooterPreset, applyPageNumberPosition, applyFontFamily, applyFontSize,
    applyLineHeight, stepFontSize, toggleInvisibles, call,
  };
}

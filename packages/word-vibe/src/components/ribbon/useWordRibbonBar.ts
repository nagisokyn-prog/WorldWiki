import { ref, onMounted, onBeforeUnmount } from 'vue';
import type { PaperSize, RibbonCommands } from '../../ribbon/commands';

export type { PaperSize, RibbonCommands };

export interface RibbonProps {
  commands: RibbonCommands;
  isInsideTable?: boolean;
}

export type RibbonEmit = <T extends 'open-paragraph-dialog' | 'open-font-dialog' | 'open-page-setup' | 'open-header-footer-dialog'>(
  e: T,
  ...args: unknown[]
) => void;

export function useWordRibbonBar(props: RibbonProps, _emit: RibbonEmit) {
  // Логирующий прокси поверх props.commands для шаблона: setup-биндинг `commands`
  // перекрывает проп, перехватывая все прямые вызовы.
  const commands = new Proxy({} as RibbonCommands, {
    get(_target, prop: string) {
      const cmd = props.commands?.[prop];
      if (typeof cmd === 'function') {
        return (...args: unknown[]) => {
          return (cmd as (...a: unknown[]) => unknown).apply(props.commands, args);
        };
      }
      return cmd;
    },
  });

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

  const applyLeftIndent = () => props.commands.setLeftIndentCm?.(Number(indentLeftCm.value) || 0);
  const applyRightIndent = () => props.commands.setRightIndentCm?.(Number(indentRightCm.value) || 0);
  const applySpacing = () => props.commands.setParagraphSpacing?.(Number(spacingBeforePt.value) || 0, Number(spacingAfterPt.value) || 0);

  const applyHeaderPreset = (preset: 'empty' | 'chapter-left' | 'chapter-center') => {
    if (preset === 'empty') props.commands.updateHeaderText?.('', '');
    else if (preset === 'chapter-left') props.commands.updateHeaderText?.('Название главы', '');
    else props.commands.updateHeaderText?.('', 'Название главы');
    closeDropdown();
  };

  const applyFooterPreset = (preset: 'empty' | 'page-right' | 'page-center' | 'page-only-right') => {
    if (preset === 'empty') props.commands.updateFooterText?.('', '');
    else if (preset === 'page-right') props.commands.updateFooterText?.('', 'Стр. {page} из {total}');
    else if (preset === 'page-center') props.commands.updateFooterText?.('Стр. {page} из {total}', '');
    else props.commands.updateFooterText?.('', '{page}');
    closeDropdown();
  };

  const applyPageNumberPosition = (
    position: 'header-left' | 'header-center' | 'header-right' | 'footer-left' | 'footer-center' | 'footer-right'
  ) => {
    props.commands.updateHeaderText?.('', '');
    props.commands.updateFooterText?.('', '');
    if (position === 'header-left') props.commands.updateHeaderText?.('{page}', '');
    else if (position === 'header-center') props.commands.updateHeaderText?.('', '{page}');
    else if (position === 'header-right') props.commands.updateHeaderText?.('', '{page}');
    else if (position === 'footer-left') props.commands.updateFooterText?.('{page}', '');
    else if (position === 'footer-center') props.commands.updateFooterText?.('{page}', '');
    else props.commands.updateFooterText?.('', '{page}');
    closeDropdown();
  };

  const handleViewportChange = () => closeDropdown();

  onMounted(() => {
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', handleViewportChange, true);
    window.removeEventListener('resize', handleViewportChange);
  });

  const applyFontFamily = () => props.commands.setFontFamily?.(currentFontFamily.value);
  const applyFontSize = () => props.commands.setFontSize?.(currentFontSize.value);
  const applyLineHeight = () => props.commands.setLineHeight?.(currentLineHeight.value);

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

  const call = (_name: string, fn: (() => unknown) | undefined) => fn?.();

  const onRibbonMousedown = (e: MouseEvent): void => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('select, input, textarea')) return;
    e.preventDefault();
  };

  return {
    activeTab, currentPageSize, currentFontFamily, currentFontSize, currentLineHeight,
    showInvisibles, openDropdown, dropdownPos, indentLeftCm, indentRightCm,
    spacingBeforePt, spacingAfterPt, toggleDropdown, closeDropdown,
    applyLeftIndent, applyRightIndent, applySpacing, applyHeaderPreset,
    applyFooterPreset, applyPageNumberPosition, applyFontFamily, applyFontSize,
    applyLineHeight, stepFontSize, toggleInvisibles, call, commands,
    onRibbonMousedown,
  };
}

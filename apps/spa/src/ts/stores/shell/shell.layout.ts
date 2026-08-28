/**
 * @file shell.layout.ts
 * @description Управление геометрией экрана, сайдбаром, ресайзерами и системными панелями
 */

import { ref } from 'vue';
import { settingsService, type AppSettings } from '@worldwiki/components';
import type { EditorGroup } from './shell.types';

export function useShellLayout(options?: {
  onGroupResizeEnd?: () => void;
  getEditorGroups?: () => EditorGroup[];
}) {
  const activeView = ref<'entity' | 'chapters' | 'static' | 'sandbox'>('entity');
  const currentSidebarTab = ref<string | null>(null);
  const showSettings = ref(false);
  const sidebarSearch = ref('');
  const activePanelTab = ref('');
  const activeField = ref('name');
  const panelHeight = ref(parseInt(localStorage.getItem('app-panel-height') || '150'));
  const sidebarWidth = ref(parseInt(localStorage.getItem('app-sidebar-width') || '280'));
  const splitLeftWidth = ref(parseFloat(localStorage.getItem('app-split-width') || '50'));
  const sidebarVisible = ref(true);
  const isWowilonOpen = ref(false);
  const settings = ref<AppSettings>(settingsService.getSettings());

  settingsService.onChange((s: AppSettings) => {
    settings.value = s;
    if (s.spacing?.sidebarWidth) sidebarWidth.value = s.spacing.sidebarWidth;
    if (s.spacing?.panelHeight) panelHeight.value = s.spacing.panelHeight;
    if (s.layout?.focusMode !== undefined) {
      sidebarVisible.value = !s.layout.focusMode;
    }
  });

  const toggleSettings = (forceState?: boolean) => {
    showSettings.value = forceState !== undefined ? forceState : !showSettings.value;
  };

  const resetSettings = () => {
    settingsService.resetSettings();
    settings.value = settingsService.getSettings();
  };

  // ─── Resizers ─────────────────────────
  const startResize = (e: MouseEvent) => {
    const startY = e.clientY;
    const startH = panelHeight.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    document.body.classList.add('resizing');
    const onMove = (ev: MouseEvent) => {
      panelHeight.value = Math.max(80, Math.min(600, startH - (ev.clientY - startY)));
      localStorage.setItem('app-panel-height', panelHeight.value.toString());
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startSidebarResize = (e: MouseEvent) => {
    const startX = e.clientX;
    const startW = sidebarWidth.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('resizing');
    const onMove = (ev: MouseEvent) => {
      const isReverse = settings.value.layout?.sidebarPos === 'row-reverse';
      const delta = isReverse ? (startX - ev.clientX) : (ev.clientX - startX);
      sidebarWidth.value = Math.max(180, Math.min(600, startW + delta));
      localStorage.setItem('app-sidebar-width', sidebarWidth.value.toString());
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startSplitResize = (_e: MouseEvent) => {
    const container = document.getElementById('shellMainSplit');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('resizing');
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      splitLeftWidth.value = Math.max(20, Math.min(80, pct));
      localStorage.setItem('app-split-width', splitLeftWidth.value.toString());
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startGroupResize = (e: MouseEvent, index: number) => {
    const groups = options?.getEditorGroups ? options.getEditorGroups() : [];
    const left = groups[index];
    const right = groups[index + 1];
    if (!left || !right) return;

    const startX = e.clientX;
    const container = (e.currentTarget as HTMLElement).closest('.editor-groups-container');
    const totalW = container ? container.getBoundingClientRect().width : window.innerWidth;
    const startLeftPct = left.flexBasis;
    const startRightPct = right.flexBasis;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    const onMove = (ev: MouseEvent) => {
      const deltaPct = ((ev.clientX - startX) / totalW) * 100;
      const newLeft = Math.max(15, Math.min(85, startLeftPct + deltaPct));
      const newRight = Math.max(15, Math.min(85, startRightPct - deltaPct));
      if (newLeft + newRight > 100 || newLeft < 15 || newRight < 15) return;
      left.flexBasis = newLeft;
      right.flexBasis = newRight;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      options?.onGroupResizeEnd?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return {
    activeView,
    currentSidebarTab,
    showSettings,
    sidebarSearch,
    activePanelTab,
    activeField,
    panelHeight,
    sidebarWidth,
    splitLeftWidth,
    sidebarVisible,
    isWowilonOpen,
    settings,
    toggleSettings,
    resetSettings,
    startResize,
    startSidebarResize,
    startSplitResize,
    startGroupResize
  };
}

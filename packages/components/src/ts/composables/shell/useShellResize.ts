import { type Ref, onUnmounted } from 'vue';
import type { useEditorGroups } from '../useEditorGroups';
import type { AppSettings } from '../../types/settings';

export interface ShellResizeDeps {
  prefix: string;
  panelHeight: Ref<number>;
  sidebarWidth: Ref<number>;
  settings: Ref<AppSettings>;
  eg: ReturnType<typeof useEditorGroups>;
  saveState: () => void;
}

export function useShellResize(deps: ShellResizeDeps) {
  let activeCleanup: (() => void) | null = null;

  const startResize = (e: MouseEvent) => {
    if (activeCleanup) {
      activeCleanup();
    }
    const startY = e.clientY;
    const startH = deps.panelHeight.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    document.body.classList.add('resizing');
    const onMove = (ev: MouseEvent) => {
      deps.panelHeight.value = Math.max(80, Math.min(600, startH - (ev.clientY - startY)));
      localStorage.setItem(`${deps.prefix}:panel-height`, String(deps.panelHeight.value));
    };
    const onUp = () => {
      if (activeCleanup) {
        activeCleanup();
        activeCleanup = null;
      }
    };
    activeCleanup = () => {
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
    if (activeCleanup) {
      activeCleanup();
    }
    const startX = e.clientX;
    const startW = deps.sidebarWidth.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    document.body.classList.add('resizing');
    const onMove = (ev: MouseEvent) => {
      const isReverse = deps.settings.value.layout?.sidebarPos === 'row-reverse';
      const diff = ev.clientX - startX;
      deps.sidebarWidth.value = Math.max(160, Math.min(520, startW + (isReverse ? -diff : diff)));
      localStorage.setItem(`${deps.prefix}:sidebar-width`, String(deps.sidebarWidth.value));
    };
    const onUp = () => {
      if (activeCleanup) {
        activeCleanup();
        activeCleanup = null;
      }
    };
    activeCleanup = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing');
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startGroupResize = (e: MouseEvent, groupIdx: number) => {
    if (activeCleanup) {
      activeCleanup();
    }
    const container = (e.currentTarget as HTMLElement).closest('.editor-groups-container') as HTMLElement;
    if (!container) return;
    const totalW = container.getBoundingClientRect().width;
    const startX = e.clientX;
    const groups = deps.eg.groups.value;
    const left = groups[groupIdx];
    const right = groups[groupIdx + 1];
    if (!left || !right) return;
    const startLeft = left.flexBasis;
    const startRight = right.flexBasis;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    const onMove = (ev: MouseEvent) => {
      const d = ((ev.clientX - startX) / totalW) * 100;
      const nl = Math.max(15, Math.min(85, startLeft + d));
      const nr = Math.max(15, Math.min(85, startRight - d));
      if (nl + nr > 100 || nl < 15 || nr < 15) return;
      left.flexBasis = nl;
      right.flexBasis = nr;
    };
    const onUp = () => {
      if (activeCleanup) {
        activeCleanup();
        activeCleanup = null;
      }
      deps.saveState();
    };
    activeCleanup = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  onUnmounted(() => {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
  });

  return {
    startResize,
    startSidebarResize,
    startGroupResize
  };
}

import { ref } from 'vue';

export function useResizers(ctx: {
  settings: { value: { layout: { sidebarPos?: string } } };
  saveState: () => void;
  splitLeftWidth: { value: number };
}) {
  const panelHeight = ref<number>(parseInt(localStorage.getItem('app-panel-height') || '150'));
  const sidebarWidth = ref<number>(parseInt(localStorage.getItem('app-sidebar-width') || '280'));

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
      const isReverse = ctx.settings.value.layout.sidebarPos === 'row-reverse';
      const diff = ev.clientX - startX;
      sidebarWidth.value = Math.max(160, Math.min(520, startW + (isReverse ? -diff : diff)));
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

  const startSplitResize = (e: MouseEvent) => {
    const wrapper = (e.target as HTMLElement).closest('.split-layout-wrapper') as HTMLElement;
    if (!wrapper) return;
    const totalW = wrapper.getBoundingClientRect().width;
    const startX = e.clientX;
    const startPct = ctx.splitLeftWidth.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    const onMove = (ev: MouseEvent) => {
      const pct = Math.max(20, Math.min(80, startPct + ((ev.clientX - startX) / totalW) * 100));
      ctx.splitLeftWidth.value = pct;
      wrapper.style.setProperty('--split-left-width', `${pct}%`);
      localStorage.setItem('app-split-width', String(pct));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startGroupResize = (e: MouseEvent, groupIdx: number) => {
    const container = (e.currentTarget as HTMLElement).closest('.editor-groups-container') as HTMLElement;
    if (!container) return;
    const totalW = container.getBoundingClientRect().width;
    const startX = e.clientX;
    const groups = (ctx as any).eg.groups.value;
    const left = groups[groupIdx];
    const right = groups[groupIdx + 1];
    if (!left || !right) return;
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
      ctx.saveState();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return {
    panelHeight,
    sidebarWidth,
    startResize,
    startSidebarResize,
    startSplitResize,
    startGroupResize,
  };
}
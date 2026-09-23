import { ref, watch, onMounted, onUnmounted } from 'vue';

export function useChapterLayout() {
  const isVolumePlanOpen = ref(false);
  const isChapterPlanOpen = ref(true);
  const volumePlanRef = ref<{ addItem: () => void } | null>(null);
  const chapterPlanRef = ref<{ addItem: () => void } | null>(null);
  
  const addVolumePlanItem = async () => {
    if (!isVolumePlanOpen.value) {
      isVolumePlanOpen.value = true;
    }
    setTimeout(() => {
      if (volumePlanRef.value) {
        volumePlanRef.value.addItem();
      }
    }, 50);
  };

  const addChapterPlanItem = async () => {
    if (!isChapterPlanOpen.value) {
      isChapterPlanOpen.value = true;
    }
    setTimeout(() => {
      if (chapterPlanRef.value) {
        chapterPlanRef.value.addItem();
      }
    }, 50);
  };

  const chaptersSidebarWidth = ref(parseInt(localStorage.getItem('chapters-sidebar-width') || '280'));
  
  const startChaptersSidebarResize = (e: MouseEvent) => {
    const startX = e.clientX;
    const startW = chaptersSidebarWidth.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    let rafId: number | null = null;
    let latestWidth = startW;

    const onMove = (ev: MouseEvent) => {
      latestWidth = Math.max(180, Math.min(520, startW + (ev.clientX - startX)));
      chaptersSidebarWidth.value = latestWidth;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
        });
      }
    };
    const onUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      chaptersSidebarWidth.value = latestWidth;
      localStorage.setItem('chapters-sidebar-width', latestWidth.toString());
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const isExportModalOpen = ref(false);
  const isQuickLinkPanelHidden = localStorage.getItem('quickLinkPanelHidden') === 'true';
  const showQuickLinkHint = ref(!isQuickLinkPanelHidden);
  const hideQuickLinkHintForever = ref(localStorage.getItem('hideQuickLinkHintForever') === 'true');
  
  watch(showQuickLinkHint, (val) => {
    localStorage.setItem('quickLinkPanelHidden', (!val).toString());
  });

  const dismissQuickLinkHintForever = () => {
    showQuickLinkHint.value = false;
    hideQuickLinkHintForever.value = true;
    localStorage.setItem('hideQuickLinkHintForever', 'true');
  };

  const isZenMode = ref(false);
  
  const toggleZenMode = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Zen Mode: Error entering fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const onFullscreenChange = () => {
    isZenMode.value = !!document.fullscreenElement;
  };

  const rightPanelWidth = ref(320);
  const isRightPanelVisible = ref(localStorage.getItem('chapters-right-panel-visible') !== 'false');
  let isDragging = false;
  let startX = 0;
  let startWidth = 0;
  let rightRafId: number | null = null;
  let latestRightWidth = 320;

  const startResize = (e: MouseEvent) => {
    isDragging = true;
    startX = e.clientX;
    startWidth = rightPanelWidth.value;
    latestRightWidth = startWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const delta = startX - e.clientX;
    latestRightWidth = Math.max(200, Math.min(600, startWidth + delta));
    rightPanelWidth.value = latestRightWidth;
    if (rightRafId === null) {
      rightRafId = requestAnimationFrame(() => {
        rightRafId = null;
      });
    }
  };

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      if (rightRafId !== null) {
        cancelAnimationFrame(rightRafId);
        rightRafId = null;
      }
      rightPanelWidth.value = latestRightWidth;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('chapters-tools-panel-width', latestRightWidth.toString());
    }
  };

  const toggleRightPanel = () => {
    isRightPanelVisible.value = !isRightPanelVisible.value;
    localStorage.setItem('chapters-right-panel-visible', isRightPanelVisible.value.toString());
  };

  const handleToggleRightPanel = () => {
    const isHidden = localStorage.getItem('chapters-right-panel-visible') === 'false';
    isRightPanelVisible.value = !isHidden;
  };

  const handleToggleStructure = () => {
    document.dispatchEvent(new CustomEvent('ww:structure-toggled'));
  };

  onMounted(() => {
    if (localStorage.getItem('quickLinkPanelHidden') === 'true') {
      showQuickLinkHint.value = false;
    }

    const savedWidth = localStorage.getItem('chapters-tools-panel-width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth);
      if (!isNaN(parsed)) {
        rightPanelWidth.value = Math.max(200, Math.min(600, parsed));
      }
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('ww:toggle-right-panel', handleToggleRightPanel as EventListener);
    document.addEventListener('ww:toggle-chapter-right-panel', toggleRightPanel as EventListener);
    document.addEventListener('ww:toggle-structure', handleToggleStructure as EventListener);
  });

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('ww:toggle-right-panel', handleToggleRightPanel as EventListener);
    document.removeEventListener('ww:toggle-chapter-right-panel', toggleRightPanel as EventListener);
    document.removeEventListener('ww:toggle-structure', handleToggleStructure as EventListener);
  });

  return {
    isVolumePlanOpen, isChapterPlanOpen, volumePlanRef, chapterPlanRef,
    addVolumePlanItem, addChapterPlanItem,
    chaptersSidebarWidth, startChaptersSidebarResize,
    isExportModalOpen, showQuickLinkHint,
    isZenMode,
    toggleZenMode,
    onFullscreenChange,
    rightPanelWidth, isRightPanelVisible,
    startResize, toggleRightPanel,
    hideQuickLinkHintForever, dismissQuickLinkHintForever
  };
}

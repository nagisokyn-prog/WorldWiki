import { ref, watch, onMounted, onUnmounted } from 'vue';

export function useChapterLayout() {
  const isVolumePlanOpen = ref(false);
  const isArcPlanOpen = ref(false);
  const volumePlanRef = ref<any>(null);
  const arcPlanRef = ref<any>(null);
  
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

  const addArcPlanItem = async () => {
    if (!isArcPlanOpen.value) {
      isArcPlanOpen.value = true;
    }
    setTimeout(() => {
      if (arcPlanRef.value) {
        arcPlanRef.value.addItem();
      }
    }, 50);
  };

  const chaptersSidebarWidth = ref(parseInt(localStorage.getItem('chapters-sidebar-width') || '280'));
  
  const startChaptersSidebarResize = (e: MouseEvent) => {
    const startX = e.clientX;
    const startW = chaptersSidebarWidth.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    const onMove = (ev: MouseEvent) => {
      chaptersSidebarWidth.value = Math.max(180, Math.min(520, startW + (ev.clientX - startX)));
      localStorage.setItem('chapters-sidebar-width', chaptersSidebarWidth.value.toString());
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

  const isExportModalOpen = ref(false);
  const showQuickLinkHint = ref(true);
  
  watch(showQuickLinkHint, (val) => {
    localStorage.setItem('quickLinkPanelHidden', (!val).toString());
  });

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

  const startResize = (e: MouseEvent) => {
    isDragging = true;
    startX = e.clientX;
    startWidth = rightPanelWidth.value;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const delta = startX - e.clientX;
    const newW = Math.max(200, Math.min(600, startWidth + delta));
    rightPanelWidth.value = newW;
  };

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('chapters-tools-panel-width', rightPanelWidth.value.toString());
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
    if (savedWidth) rightPanelWidth.value = parseInt(savedWidth);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('ww:toggle-right-panel', handleToggleRightPanel as any);
    document.addEventListener('ww:toggle-chapter-right-panel', toggleRightPanel as any);
    document.addEventListener('ww:toggle-structure', handleToggleStructure as any);
  });

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('ww:toggle-right-panel', handleToggleRightPanel as any);
    document.removeEventListener('ww:toggle-chapter-right-panel', toggleRightPanel as any);
    document.removeEventListener('ww:toggle-structure', handleToggleStructure as any);
  });

  return {
    isVolumePlanOpen, isArcPlanOpen, volumePlanRef, arcPlanRef, addVolumePlanItem, addArcPlanItem,
    chaptersSidebarWidth, startChaptersSidebarResize,
    isExportModalOpen, showQuickLinkHint,
    isZenMode, toggleZenMode, onFullscreenChange,
    rightPanelWidth, isRightPanelVisible, startResize, toggleRightPanel, handleToggleRightPanel, handleToggleStructure
  };
}

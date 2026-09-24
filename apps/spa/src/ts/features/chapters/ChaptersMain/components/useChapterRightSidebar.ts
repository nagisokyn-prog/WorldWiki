import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { PanelResizeType, SidebarTabType, PlanScopeType } from './ChapterRightSidebar.model';
import PromisesPanel from '../../PromisesPanel/PromisesPanel.vue';
import PlanningPanel from '../../PlanningPanel/PlanningPanel.vue';
import { useStoryArcsStore } from '@/stores/story_arcs.store';

export function useChapterRightSidebar(props?: { project?: string }) {
  const storyArcsStore = useStoryArcsStore();

  const promisesPanelRef = ref<InstanceType<typeof PromisesPanel> | null>(null);
  const volumePlanRef = ref<InstanceType<typeof PlanningPanel> | null>(null);
  const arcPlanRef = ref<InstanceType<typeof PlanningPanel> | null>(null);
  const chapterPlanRef = ref<InstanceType<typeof PlanningPanel> | null>(null);

  const activeTab = ref<SidebarTabType>(
    ((localStorage.getItem('chapters-sidebar-active-tab') as SidebarTabType) === 'plans' ? 'plans' : 'promises')
  );

  const activePlanScope = ref<PlanScopeType>(
    (localStorage.getItem('chapters-sidebar-plan-scope') as PlanScopeType) || 'volume'
  );

  const selectedArcId = ref<string | null>(
    localStorage.getItem('chapters-sidebar-selected-arc-id') || null
  );

  const arcsList = computed(() => storyArcsStore.arcs);
  const currentArcTitle = computed(() => {
    if (!selectedArcId.value) return '';
    const found = arcsList.value.find(a => a.id === selectedArcId.value);
    return found?.title || 'Арка';
  });


  const setSidebarTab = (tab: SidebarTabType) => {
    activeTab.value = tab;
    localStorage.setItem('chapters-sidebar-active-tab', tab);
  };

  const setPlanScope = (scope: PlanScopeType) => {
    activePlanScope.value = scope;
    localStorage.setItem('chapters-sidebar-plan-scope', scope);
  };

  const selectArc = (arcId: string | null) => {
    selectedArcId.value = arcId;
    if (arcId) {
      localStorage.setItem('chapters-sidebar-selected-arc-id', arcId);
    } else {
      localStorage.removeItem('chapters-sidebar-selected-arc-id');
    }
  };

  const timelineHeight = ref(parseInt(localStorage.getItem('chapters-panel-timeline-h') || '260', 10));
  const participantsHeight = ref(parseInt(localStorage.getItem('chapters-panel-participants-h') || '220', 10));
  const volumePlanHeight = ref(parseInt(localStorage.getItem('chapters-panel-volplan-h') || '220', 10));
  const chapterPlanHeight = ref(parseInt(localStorage.getItem('chapters-panel-chaplan-h') || '220', 10));

  const activeResizing = ref<PanelResizeType | null>(null);

  let startY = 0;
  let startHeight = 0;
  let activePanel: PanelResizeType | null = null;
  let rafId: number | null = null;
  let currentHeight = 0;

  const startVerticalResize = (e: MouseEvent, panel: PanelResizeType) => {
    e.preventDefault();
    e.stopPropagation();
    activePanel = panel;
    activeResizing.value = panel;
    startY = e.clientY;

    if (panel === 'timeline') {
      startHeight = timelineHeight.value;
    } else if (panel === 'participants') {
      startHeight = participantsHeight.value;
    } else if (panel === 'volumePlan') {
      startHeight = volumePlanHeight.value;
    } else if (panel === 'chapterPlan') {
      startHeight = chapterPlanHeight.value;
    }
    currentHeight = startHeight;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!activePanel) return;
    const deltaY = e.clientY - startY;
    const minH = 80;
    const maxH = 1000;
    currentHeight = Math.max(minH, Math.min(maxH, startHeight + deltaY));

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (activePanel === 'timeline') {
          timelineHeight.value = currentHeight;
        } else if (activePanel === 'participants') {
          participantsHeight.value = currentHeight;
        } else if (activePanel === 'volumePlan') {
          volumePlanHeight.value = currentHeight;
        } else if (activePanel === 'chapterPlan') {
          chapterPlanHeight.value = currentHeight;
        }
        rafId = null;
      });
    }
  };

  const onMouseUp = () => {
    if (activePanel) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      if (activePanel === 'timeline') {
        timelineHeight.value = currentHeight;
        localStorage.setItem('chapters-panel-timeline-h', currentHeight.toString());
      } else if (activePanel === 'participants') {
        participantsHeight.value = currentHeight;
        localStorage.setItem('chapters-panel-participants-h', currentHeight.toString());
      } else if (activePanel === 'volumePlan') {
        volumePlanHeight.value = currentHeight;
        localStorage.setItem('chapters-panel-volplan-h', currentHeight.toString());
      } else if (activePanel === 'chapterPlan') {
        chapterPlanHeight.value = currentHeight;
        localStorage.setItem('chapters-panel-chaplan-h', currentHeight.toString());
      }

      activePanel = null;
      activeResizing.value = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  };

  const addPromise = (payload: { kind: string; quote: string; paragraph_index: number; block_id?: string | null }) => {
    setSidebarTab('promises');
    return promisesPanelRef.value?.addPromise(payload);
  };

  const addMilestone = (payload: {
    promiseId: string;
    stage: 'progression' | 'resolution';
    quote: string;
    paragraph_index: number;
    block_id?: string | null;
    chapterId?: string;
  }) => {
    setSidebarTab('promises');
    return promisesPanelRef.value?.addMilestone(payload);
  };

  const loadPromises = () => {
    return promisesPanelRef.value?.loadPromises();
  };

  const promises = computed(() => {
    return promisesPanelRef.value?.promises || [];
  });

  onMounted(() => {
    // validate parsed heights
    if (isNaN(timelineHeight.value) || timelineHeight.value < 80) timelineHeight.value = 260;
    if (isNaN(participantsHeight.value) || participantsHeight.value < 80) participantsHeight.value = 220;
    if (isNaN(volumePlanHeight.value) || volumePlanHeight.value < 80) volumePlanHeight.value = 220;
    if (isNaN(chapterPlanHeight.value) || chapterPlanHeight.value < 80) chapterPlanHeight.value = 220;

    if (props?.project) {
      void storyArcsStore.loadArcs(props.project);
    }
  });

  onUnmounted(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  return {
    promisesPanelRef,
    volumePlanRef,
    arcPlanRef,
    chapterPlanRef,
    activeTab,
    activePlanScope,
    selectedArcId,
    arcsList,
    currentArcTitle,
    setSidebarTab,
    setPlanScope,
    selectArc,
    timelineHeight,
    participantsHeight,
    volumePlanHeight,
    chapterPlanHeight,
    activeResizing,
    startVerticalResize,
    addPromise,
    addMilestone,
    loadPromises,
    promises
  };
}



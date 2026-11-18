import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useChapterRightSidebar } from './useChapterRightSidebar';
import { setActivePinia, createPinia } from 'pinia';

describe('useChapterRightSidebar', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes heights from default values or localStorage', () => {
    const { timelineHeight, participantsHeight, volumePlanHeight, chapterPlanHeight } = useChapterRightSidebar();
    expect(timelineHeight.value).toBe(260);
    expect(participantsHeight.value).toBe(220);
    expect(volumePlanHeight.value).toBe(220);
    expect(chapterPlanHeight.value).toBe(220);
  });

  it('loads saved heights from localStorage if present', () => {
    localStorage.setItem('chapters-panel-timeline-h', '350');
    localStorage.setItem('chapters-panel-participants-h', '300');
    const { timelineHeight, participantsHeight } = useChapterRightSidebar();
    expect(timelineHeight.value).toBe(350);
    expect(participantsHeight.value).toBe(300);
  });

  it('resizes timeline height smoothly on mousemove and saves on mouseup', () => {
    const { timelineHeight, activeResizing, startVerticalResize } = useChapterRightSidebar();
    
    // Simulate mousedown on timeline resizer at clientY = 100
    const mousedownEv = new MouseEvent('mousedown', { clientY: 100 });
    startVerticalResize(mousedownEv, 'timeline');

    expect(activeResizing.value).toBe('timeline');

    // Simulate mousemove to clientY = 150 (delta +50)
    const mousemoveEv = new MouseEvent('mousemove', { clientY: 150 });
    document.dispatchEvent(mousemoveEv);

    // Simulate mouseup
    const mouseupEv = new MouseEvent('mouseup');
    document.dispatchEvent(mouseupEv);

    expect(activeResizing.value).toBeNull();
    expect(timelineHeight.value).toBe(310);
    expect(localStorage.getItem('chapters-panel-timeline-h')).toBe('310');
  });

  it('clamps minimum height to 80px', () => {
    const { timelineHeight, startVerticalResize } = useChapterRightSidebar();
    
    const mousedownEv = new MouseEvent('mousedown', { clientY: 500 });
    startVerticalResize(mousedownEv, 'timeline');

    // Pull up by 500px -> 260 - 500 = -240 -> clamped to 80
    const mousemoveEv = new MouseEvent('mousemove', { clientY: 0 });
    document.dispatchEvent(mousemoveEv);

    const mouseupEv = new MouseEvent('mouseup');
    document.dispatchEvent(mouseupEv);

    expect(timelineHeight.value).toBe(80);
    expect(localStorage.getItem('chapters-panel-timeline-h')).toBe('80');
  });

  it('manages activeTab and persists to localStorage', () => {
    const { activeTab, setSidebarTab } = useChapterRightSidebar();
    expect(activeTab.value).toBe('promises');

    setSidebarTab('plans');
    expect(activeTab.value).toBe('plans');
    expect(localStorage.getItem('chapters-sidebar-active-tab')).toBe('plans');

    setSidebarTab('promises');
    expect(activeTab.value).toBe('promises');
    expect(localStorage.getItem('chapters-sidebar-active-tab')).toBe('promises');
  });

  it('manages activePlanScope and persists to localStorage', () => {
    const { activePlanScope, setPlanScope } = useChapterRightSidebar();
    expect(activePlanScope.value).toBe('volume');

    setPlanScope('arc');
    expect(activePlanScope.value).toBe('arc');
    expect(localStorage.getItem('chapters-sidebar-plan-scope')).toBe('arc');

    setPlanScope('chapter');
    expect(activePlanScope.value).toBe('chapter');
    expect(localStorage.getItem('chapters-sidebar-plan-scope')).toBe('chapter');
  });

  it('manages selectedArcId and persists to localStorage', () => {
    const { selectedArcId, selectArc } = useChapterRightSidebar();
    expect(selectedArcId.value).toBeNull();

    selectArc('arc_42');
    expect(selectedArcId.value).toBe('arc_42');
    expect(localStorage.getItem('chapters-sidebar-selected-arc-id')).toBe('arc_42');

    selectArc(null);
    expect(selectedArcId.value).toBeNull();
    expect(localStorage.getItem('chapters-sidebar-selected-arc-id')).toBeNull();
  });

  it('resizes participants, volumePlan, chapterPlan, delegates panel methods, and cleans up on unmount', async () => {
    const { defineComponent } = await import('vue');
    const { mount } = await import('@vue/test-utils');
    localStorage.setItem('chapters-panel-timeline-h', 'invalid');
    localStorage.setItem('chapters-panel-participants-h', '20');
    localStorage.setItem('chapters-panel-volplan-h', '30');
    localStorage.setItem('chapters-panel-chaplan-h', '40');

    let sidebar!: ReturnType<typeof useChapterRightSidebar>;
    const Comp = defineComponent({
      setup() {
        sidebar = useChapterRightSidebar({ project: 'proj-1' });
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    expect(sidebar.timelineHeight.value).toBe(260);
    expect(sidebar.participantsHeight.value).toBe(220);
    expect(sidebar.volumePlanHeight.value).toBe(220);
    expect(sidebar.chapterPlanHeight.value).toBe(220);

    const addPromise = vi.fn();
    const addMilestone = vi.fn();
    const addSubScene = vi.fn();
    const loadPromises = vi.fn();
    sidebar.promisesPanelRef.value = {
      addPromise,
      addMilestone,
      addSubScene,
      loadPromises,
      promises: [{ id: 'p1' }],
    } as unknown as typeof sidebar.promisesPanelRef.value;

    expect(sidebar.promises.value).toHaveLength(1);
    sidebar.addPromise({ kind: 'gun', quote: 'Q', paragraph_index: 1 });
    expect(addPromise).toHaveBeenCalled();
    sidebar.addMilestone({ promiseId: 'p1', stage: 'resolution', quote: 'M', paragraph_index: 2 });
    expect(addMilestone).toHaveBeenCalled();
    sidebar.addSubScene({ id: 'p1' } as never, { quote: 'S', paragraph_index: 3 });
    expect(addSubScene).toHaveBeenCalled();
    sidebar.loadPromises();
    expect(loadPromises).toHaveBeenCalled();

    for (const panel of ['participants', 'volumePlan', 'chapterPlan'] as const) {
      sidebar.startVerticalResize(new MouseEvent('mousedown', { clientY: 100 }), panel);
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 130 }));
      document.dispatchEvent(new MouseEvent('mouseup'));
    }

    expect(sidebar.participantsHeight.value).toBe(250);
    expect(sidebar.volumePlanHeight.value).toBe(250);
    expect(sidebar.chapterPlanHeight.value).toBe(250);

    wrapper.unmount();
  });

  it('covers plans tab from localStorage, selectedArcTitle, chapterPlan toggle, RAF throttle, and unmount during resize', async () => {
    const { defineComponent } = await import('vue');
    const { mount } = await import('@vue/test-utils');
    localStorage.setItem('chapters-sidebar-active-tab', 'plans');

    let sidebar!: ReturnType<typeof useChapterRightSidebar>;
    const Comp = defineComponent({
      setup() {
        sidebar = useChapterRightSidebar({ project: 'proj-1' });
        return {};
      },
      template: '<div></div>',
    });

    const wrapper = mount(Comp);
    expect(sidebar.activeTab.value).toBe('plans');
    expect(sidebar.selectedArcTitle.value).toBe('');

    sidebar.selectArc('arc_unknown');
    expect(sidebar.selectedArcTitle.value).toBe('Арка');

    sidebar.togglePanel('chapterPlan');
    sidebar.togglePanel('chapterPlan');

    // RAF throttling with 2 mousemove events before mouseup
    sidebar.startVerticalResize(new MouseEvent('mousedown', { clientY: 100 }), 'timeline');
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 120 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 140 }));
    // Unmount while resizing to trigger rafId / listener cleanup
    wrapper.unmount();
  });
});


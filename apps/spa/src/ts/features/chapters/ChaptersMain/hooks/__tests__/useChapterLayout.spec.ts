import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useChapterLayout } from '../useChapterLayout';

const TestComponent = defineComponent({
  setup() {
    return { ...useChapterLayout() };
  },
  template: '<div></div>',
});

describe('useChapterLayout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('manages volume and arc plan item additions', async () => {
    const layout = useChapterLayout();
    const mockVolumeRef = { addItem: vi.fn() };
    const mockArcRef = { addItem: vi.fn() };

    layout.volumePlanRef.value = mockVolumeRef;
    layout.arcPlanRef.value = mockArcRef;

    expect(layout.isVolumePlanOpen.value).toBe(false);
    layout.addVolumePlanItem();
    expect(layout.isVolumePlanOpen.value).toBe(true);
    vi.advanceTimersByTime(60);
    expect(mockVolumeRef.addItem).toHaveBeenCalled();

    expect(layout.isArcPlanOpen.value).toBe(false);
    layout.addArcPlanItem();
    expect(layout.isArcPlanOpen.value).toBe(true);
    vi.advanceTimersByTime(60);
    expect(mockArcRef.addItem).toHaveBeenCalled();
  });

  it('handles chapters sidebar resizing with limits', () => {
    const layout = useChapterLayout();
    expect(layout.chaptersSidebarWidth.value).toBe(280);

    const startEvent = new MouseEvent('mousedown', { clientX: 100 });
    layout.startChaptersSidebarResize(startEvent);

    // Mouse move forward
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 }));
    expect(layout.chaptersSidebarWidth.value).toBe(480);

    // Mouse move beyond max limit 520
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600 }));
    expect(layout.chaptersSidebarWidth.value).toBe(520);

    // Mouse move below min limit 180
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: -200 }));
    expect(layout.chaptersSidebarWidth.value).toBe(180);

    // Mouse up
    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(localStorage.getItem('chapters-sidebar-width')).toBe('180');
  });

  it('handles quick link hint persistence and dismissing', async () => {
    const layout = useChapterLayout();

    expect(layout.showQuickLinkHint.value).toBe(true);
    layout.showQuickLinkHint.value = false;
    await Promise.resolve();
    expect(localStorage.getItem('quickLinkPanelHidden')).toBe('true');

    layout.dismissQuickLinkHintForever();
    expect(layout.showQuickLinkHint.value).toBe(false);
    expect(layout.hideQuickLinkHintForever.value).toBe(true);
    expect(localStorage.getItem('hideQuickLinkHintForever')).toBe('true');
  });

  it('handles Zen mode and fullscreen toggling', async () => {
    const reqFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn();
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: reqFullscreen,
      writable: true,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      value: exitFullscreen,
      writable: true,
    });

    const layout = useChapterLayout();

    // Toggle to enter fullscreen
    layout.toggleZenMode();
    expect(reqFullscreen).toHaveBeenCalled();

    // Catch rejected requestFullscreen
    reqFullscreen.mockRejectedValueOnce(new Error('Blocked'));
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    layout.toggleZenMode();
    await Promise.resolve();
    expect(spyError).toHaveBeenCalled();
    spyError.mockRestore();

    // When already in fullscreen, exits
    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      configurable: true,
    });
    layout.onFullscreenChange();
    expect(layout.isZenMode.value).toBe(true);

    layout.toggleZenMode();
    expect(exitFullscreen).toHaveBeenCalled();

    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
    layout.onFullscreenChange();
    expect(layout.isZenMode.value).toBe(false);
  });

  it('manages right tools panel resizing and toggles via events in mounted lifecycle', () => {
    localStorage.setItem('chapters-tools-panel-width', '350');
    localStorage.setItem('quickLinkPanelHidden', 'true');

    const wrapper = mount(TestComponent);
    const vm = wrapper.vm as any;

    expect(vm.rightPanelWidth).toBe(350);
    expect(vm.showQuickLinkHint).toBe(false);

    // Right panel resizing
    vm.startResize({ clientX: 500 } as any);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400 }));
    expect(vm.rightPanelWidth).toBe(450);

    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(localStorage.getItem('chapters-tools-panel-width')).toBe('450');

    // Custom events
    document.dispatchEvent(new CustomEvent('ww:toggle-chapter-right-panel'));
    expect(vm.isRightPanelVisible).toBe(false);

    localStorage.setItem('chapters-right-panel-visible', 'true');
    document.dispatchEvent(new CustomEvent('ww:toggle-right-panel'));
    expect(vm.isRightPanelVisible).toBe(true);

    wrapper.unmount();
  });

  it('handles plan item additions when already open and with null refs, and right panel clamp bounds', () => {
    const wrapper = mount(TestComponent);
    const vm = wrapper.vm as any;

    // Plan addition when already open and ref is null
    vm.isVolumePlanOpen = true;
    vm.volumePlanRef = null;
    vm.addVolumePlanItem();
    vi.advanceTimersByTime(60);

    vm.isArcPlanOpen = true;
    vm.arcPlanRef = null;
    vm.addArcPlanItem();
    vi.advanceTimersByTime(60);

    // Mousemove / mouseup when not dragging
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }));
    document.dispatchEvent(new MouseEvent('mouseup'));

    // Dragging beyond 600 max and below 200 min
    vm.startResize({ clientX: 500 } as any);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 })); // delta = 400 -> 320 + 400 = 720 > 600
    expect(vm.rightPanelWidth).toBe(600);

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 900 })); // delta = -400 -> 320 - 400 = -80 < 200
    expect(vm.rightPanelWidth).toBe(200);

    document.dispatchEvent(new MouseEvent('mouseup'));
    wrapper.unmount();
  });
});


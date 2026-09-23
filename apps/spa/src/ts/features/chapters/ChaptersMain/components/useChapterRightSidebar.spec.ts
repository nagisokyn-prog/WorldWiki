import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useChapterRightSidebar } from './useChapterRightSidebar';

describe('useChapterRightSidebar', () => {
  beforeEach(() => {
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
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCalendarTreeResize } from '../useCalendarTreeResize';

describe('useCalendarTreeResize', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with default height 170 when storage is empty', () => {
    const { calendarHeight, isResizing } = useCalendarTreeResize();
    expect(calendarHeight.value).toBe(170);
    expect(isResizing.value).toBe(false);
  });

  it('restores height from localStorage if available', () => {
    localStorage.setItem('chapter-tree-calendar-h', '220');
    const { calendarHeight } = useCalendarTreeResize();
    expect(calendarHeight.value).toBe(220);
  });

  it('handles startVerticalResize and updates height on mousemove', () => {
    const { calendarHeight, isResizing, startVerticalResize } = useCalendarTreeResize();
    const event = new MouseEvent('mousedown', { clientY: 100 });
    startVerticalResize(event);

    expect(isResizing.value).toBe(true);

    const moveEvent = new MouseEvent('mousemove', { clientY: 150 });
    document.dispatchEvent(moveEvent);

    const upEvent = new MouseEvent('mouseup');
    document.dispatchEvent(upEvent);

    expect(isResizing.value).toBe(false);
    expect(calendarHeight.value).toBe(220);
    expect(localStorage.getItem('chapter-tree-calendar-h')).toBe('220');
  });

  it('clamps height within min (70) and max (500)', () => {
    const { calendarHeight, startVerticalResize } = useCalendarTreeResize();
    const event = new MouseEvent('mousedown', { clientY: 200 });
    startVerticalResize(event);

    // Try resizing below MIN_HEIGHT
    const moveBelow = new MouseEvent('mousemove', { clientY: 0 });
    document.dispatchEvent(moveBelow);
    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(calendarHeight.value).toBe(70);

    // Try resizing above MAX_HEIGHT
    startVerticalResize(new MouseEvent('mousedown', { clientY: 100 }));
    const moveAbove = new MouseEvent('mousemove', { clientY: 1000 });
    document.dispatchEvent(moveAbove);
    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(calendarHeight.value).toBe(500);
  });
});

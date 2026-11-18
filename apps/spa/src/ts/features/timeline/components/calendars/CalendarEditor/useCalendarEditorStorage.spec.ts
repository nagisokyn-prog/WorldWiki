import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCalendarStateKey,
  getCalendarScrollKey,
  saveCalendarLocalDraft,
  loadCalendarLocalDraft,
  clearCalendarLocalDraft,
  hydrateCalendarLocalDraft,
} from './useCalendarEditorStorage';

describe('useCalendarEditorStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('builds state and scroll keys with project/calendar fallbacks', () => {
    expect(getCalendarStateKey('projects:p1', 'c1')).toBe('calendar-state-p1-c1');
    expect(getCalendarStateKey(null, null)).toBe('calendar-state-default-cal_default');
    expect(getCalendarScrollKey('projects:p1', 'c1')).toBe('calendar-scroll-p1-c1');
    expect(getCalendarScrollKey(undefined, undefined)).toBe('calendar-scroll-default-cal_default');
  });

  it('saves, loads, hydrates, and clears drafts, and handles storage errors', () => {
    const key = 'cal-key';
    const scrollKey = 'cal-scroll';
    localStorage.setItem(scrollKey, '120');

    saveCalendarLocalDraft(key, { activeTab: 'tab1', unsavedName: 'Cal' });
    const loaded = loadCalendarLocalDraft(key);
    expect(loaded?.activeTab).toBe('tab1');

    const onHydrate = vi.fn();
    hydrateCalendarLocalDraft(key, onHydrate);
    expect(onHydrate).toHaveBeenCalledWith(expect.objectContaining({ activeTab: 'tab1' }));

    clearCalendarLocalDraft(key, scrollKey);
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(scrollKey)).toBeNull();

    // Missing & invalid JSON
    expect(loadCalendarLocalDraft('missing')).toBeNull();
    localStorage.setItem(key, '{bad json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadCalendarLocalDraft(key)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    // Storage errors on set/remove
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota');
    });
    saveCalendarLocalDraft(key, { activeTab: 'tab2' });

    vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
      throw new Error('rm err');
    });
    clearCalendarLocalDraft(key);
    warnSpy.mockRestore();
  });
});

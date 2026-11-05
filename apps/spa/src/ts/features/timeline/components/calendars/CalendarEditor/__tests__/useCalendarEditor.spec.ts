import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useCalendarEditor } from '../useCalendarEditor';
import { useCalendarStore } from '@/stores/calendar.store';
import { CALENDAR_PRESETS } from '@/features/timeline/components/calendars/presets';

vi.mock('@/stores/calendar.store', () => ({
  useCalendarStore: vi.fn(),
}));

describe('useCalendarEditor', () => {
  let mockCalendarStore: {
    getCalendars: ReturnType<typeof vi.fn>;
    saveCalendar: ReturnType<typeof vi.fn>;
    deleteCalendar: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockCalendarStore = {
      getCalendars: vi.fn().mockResolvedValue([
        {
          id: 'cal_earth',
          name: 'Земной календарь',
          is_master: true,
          data: {
            название: 'Земной календарь',
            месяцы: [{ название: 'Январь', дней: 31 }],
            дней_в_неделе: 7,
          },
        },
      ]),
      saveCalendar: vi.fn().mockResolvedValue({ success: true }),
      deleteCalendar: vi.fn().mockResolvedValue({ success: true }),
    };

    vi.mocked(useCalendarStore).mockReturnValue(mockCalendarStore as unknown as ReturnType<typeof useCalendarStore>);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads calendar and computes basic metrics', async () => {
    const emit = vi.fn();
    const editor = useCalendarEditor(
      { calendarId: 'cal_earth', projectId: 'test_proj' },
      emit
    );

    await flushPromises();

    expect(editor.calendarRecord.value).not.toBeNull();
    expect(editor.calendarRecord.value?.name).toBe('Земной календарь');
    expect(editor.totalDays.value).toBe(31);
    expect(editor.hasUnsavedDraft.value).toBe(false);
  });

  it('hydrates saved activeTab and unsaved draft from localStorage', async () => {
    const stateKey = 'calendar-state-test_proj-cal_earth';
    localStorage.setItem(
      stateKey,
      JSON.stringify({
        activeTab: 'erasSync',
        unsavedData: {
          название: 'Черновик календаря',
          месяцы: [{ название: 'Первомесяц', дней: 45 }],
        },
        unsavedName: 'Черновик календаря',
        timestamp: Date.now(),
      })
    );

    const emit = vi.fn();
    const editor = useCalendarEditor(
      { calendarId: 'cal_earth', projectId: 'test_proj' },
      emit
    );

    await flushPromises();

    expect(editor.activeTab.value).toBe('erasSync');
    expect(editor.calendarRecord.value?.name).toBe('Черновик календаря');
    expect(editor.hasUnsavedDraft.value).toBe(true);
    expect(editor.totalDays.value).toBe(45);
    expect(emit).toHaveBeenCalledWith('update:calendar', expect.any(Object));
  });

  it('applies presets correctly and marks draft as unsaved', async () => {
    const emit = vi.fn();
    const editor = useCalendarEditor(
      { calendarId: 'cal_earth', projectId: 'test_proj' },
      emit
    );

    await flushPromises();

    const shirePreset = CALENDAR_PRESETS.find((p) => p.id === 'shire_tolkien')!;
    editor.applyPreset(shirePreset);

    expect(editor.calendarRecord.value?.name).toBe(shirePreset.data.название);
    expect(editor.hasUnsavedDraft.value).toBe(true);
    expect(emit).toHaveBeenCalledWith('update:name', shirePreset.data.название);
    expect(emit).toHaveBeenCalledWith('update:calendar', expect.any(Object));
  });

  it('cleans up localStorage draft on successful saveCalendar', async () => {
    const emit = vi.fn();
    const editor = useCalendarEditor(
      { calendarId: 'cal_earth', projectId: 'test_proj' },
      emit
    );

    await flushPromises();

    editor.patchCalendarData({ название: 'Новое имя' });
    expect(editor.hasUnsavedDraft.value).toBe(true);

    await editor.saveCalendar();
    await flushPromises();

    expect(mockCalendarStore.saveCalendar).toHaveBeenCalled();
    expect(editor.hasUnsavedDraft.value).toBe(false);

    const savedState = JSON.parse(localStorage.getItem(editor.getStateKey()) || '{}');
    expect(savedState.unsavedData).toBeUndefined();
  });
});


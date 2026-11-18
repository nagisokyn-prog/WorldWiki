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

  it('covers updateName, setTab, modals, deleteCalendar, events, error paths, and calendarId watch', async () => {
    const { defineComponent, h, reactive } = await import('vue');
    const { mount } = await import('@vue/test-utils');

    vi.useFakeTimers();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const confirmMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirmMock);

    const props = reactive({ calendarId: 'cal_earth', projectId: 'test_proj' });
    const emit = vi.fn();
    let editor!: ReturnType<typeof useCalendarEditor>;

    const Comp = defineComponent({
      setup() {
        editor = useCalendarEditor(props, emit);
        return () => h('div');
      }
    });

    const wrapper = mount(Comp);
    await flushPromises();

    // Tabs & modals & computed fallbacks
    editor.setTab('cultureLore');
    expect(editor.activeTab.value).toBe('cultureLore');
    editor.openAuditModal();
    editor.openPresetsModal();
    expect(editor.isAuditModalOpen.value).toBe(true);
    expect(editor.isPresetsModalOpen.value).toBe(true);
    expect(editor.planetOrbitDays.value).toBe(365.2422);
    expect(editor.masterCalData.value?.название).toBe('Земной календарь');
    expect(editor.getScrollKey()).toContain('cal_earth');

    // updateName + debounced draft save
    editor.updateName('Переименованный');
    expect(editor.calendarRecord.value?.name).toBe('Переименованный');
    vi.advanceTimersByTime(300);
    expect(localStorage.getItem(editor.getStateKey())).toContain('Переименованный');

    // ww:calendar-renamed & ww:trigger-calendar-save events
    document.dispatchEvent(new CustomEvent('ww:calendar-renamed', { detail: { id: 'cal_earth', name: 'Извне' } }));
    expect(editor.calendarRecord.value?.name).toBe('Извне');

    document.dispatchEvent(new CustomEvent('ww:trigger-calendar-save', { detail: { id: 'cal_earth' } }));
    await flushPromises();
    expect(mockCalendarStore.saveCalendar).toHaveBeenCalled();

    // deleteCalendar: cancelled -> confirmed -> error
    confirmMock.mockReturnValueOnce(false);
    await editor.deleteCalendar();
    expect(mockCalendarStore.deleteCalendar).not.toHaveBeenCalled();

    confirmMock.mockReturnValueOnce(true);
    await editor.deleteCalendar();
    expect(mockCalendarStore.deleteCalendar).toHaveBeenCalledWith('cal_earth');
    expect(emit).toHaveBeenCalledWith('delete', 'cal_earth');

    confirmMock.mockReturnValueOnce(true);
    mockCalendarStore.deleteCalendar.mockRejectedValueOnce(new Error('del fail'));
    await editor.deleteCalendar();
    expect(editor.error.value).toBe('del fail');

    // saveCalendar error
    mockCalendarStore.saveCalendar.mockRejectedValueOnce(new Error('save fail'));
    await editor.saveCalendar();
    expect(editor.error.value).toBe('save fail');

    // calendarId watch loads fallback default when calendar not found
    mockCalendarStore.getCalendars.mockResolvedValueOnce([]);
    props.calendarId = 'cal_missing';
    await flushPromises();
    expect(editor.calendarRecord.value?.id).toBe('cal_missing');

    // loadCalendar error
    mockCalendarStore.getCalendars.mockRejectedValueOnce('raw load err');
    props.calendarId = 'cal_err';
    await flushPromises();
    expect(editor.error.value).toBe('Не удалось загрузить календарь');

    // Double-wrapped data.data + null data + localStorage draft hydration + null calendarRecord guards
    localStorage.setItem(
      'calendar-state-test_proj-cal_double',
      JSON.stringify({ activeTab: 'tab3', unsavedData: { название: 'DraftCal' }, unsavedName: 'DraftName' })
    );
    mockCalendarStore.getCalendars.mockResolvedValueOnce([
      { id: 'cal_double', name: '', is_master: false, is_default: false, data: { data: { название: 'Inner' } } } as any,
    ]);
    props.calendarId = 'cal_double';
    await flushPromises();
    expect(editor.activeTab.value).toBe('cultureLore');
    expect(editor.calendarRecord.value?.name).toBe('DraftName');

    editor.patchCalendarData({ is_master: true, название: 'MasterCal' });
    expect(editor.calendarRecord.value?.is_master).toBe(true);

    editor.calendarRecord.value = null;
    editor.patchCalendarData({ название: 'Ignored' });
    await editor.saveCalendar();
    await editor.deleteCalendar();
    editor.applyPreset({ name: 'P', data: {} } as any);
    editor.updateName('FallbackRec');
    expect(editor.calendarRecord.value?.name).toBe('FallbackRec');

    // Rename & trigger save custom events matching vs non-matching id
    document.dispatchEvent(new CustomEvent('ww:calendar-renamed', { detail: { id: props.calendarId, name: 'RenamedViaEvent' } }));
    expect(editor.calendarRecord.value?.name).toBe('RenamedViaEvent');

    mockCalendarStore.saveCalendar.mockResolvedValueOnce(true);
    document.dispatchEvent(new CustomEvent('ww:trigger-calendar-save', { detail: { id: 'cal_new' } }));
    await flushPromises();

    // Error branches on saveCalendar & deleteCalendar with non-Error throws
    mockCalendarStore.saveCalendar.mockRejectedValueOnce('raw save err');
    await editor.saveCalendar();
    expect(mockCalendarStore.saveCalendar).toHaveBeenCalled();

    vi.stubGlobal('confirm', () => true);
    mockCalendarStore.deleteCalendar.mockRejectedValueOnce('raw del err');
    await editor.deleteCalendar();
    expect(editor.error.value).toBe('Не удалось удалить календарь');

    // 12-month calendar without seasons gets default seasons populated
    mockCalendarStore.getCalendars.mockResolvedValueOnce([
      {
        id: 'cal_12m',
        name: '',
        data: {
          название: '12M',
          месяцы: Array.from({ length: 12 }, (_, i) => ({ название: `М${i + 1}`, дней: 30 })),
          сезоны: [],
        },
      } as any,
    ]);
    props.calendarId = 'calendars:cal_12m';
    await flushPromises();
    expect(editor.calData.value?.сезоны?.length).toBeGreaterThan(0);

    vi.unstubAllGlobals();
    errSpy.mockRestore();
    vi.useRealTimers();
    wrapper.unmount();
  });
});


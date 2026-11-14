import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive } from 'vue';
import { useTimeAtlasBridgeTab, type TimeAtlasBridgeTabProps } from './useTimeAtlasBridgeTab';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type { CalendarRecord } from '@/stores/calendar.store';

const mockExtractCalendarData = vi.fn();

vi.mock('../useTimeAtlasModal', () => ({
  extractCalendarData: (...args: unknown[]) => mockExtractCalendarData(...args)
}));

describe('useTimeAtlasBridgeTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleCal = {
    название: 'Имперский',
    эпохи: [
      { год_начала: 100, год_конца: 200 },
      { год_начала: 300, год_конца: 400 }
    ]
  } as unknown as CalendarData;

  it('computes masterCalData and filters localCalsWithData', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const masterRec = { id: 'cal:master' } as unknown as CalendarRecord;
    const localRec1 = { id: 'cal:1', title: 'L1' } as unknown as CalendarRecord;
    const localRec2 = { id: '' } as unknown as CalendarRecord;
    const localRecNull = { id: 'cal:empty' } as unknown as CalendarRecord;

    mockExtractCalendarData.mockImplementation((rec: CalendarRecord | null) => {
      if (rec?.id === 'cal:master') return sampleCal;
      if (rec?.id === 'cal:1') return { название: 'Локальный' } as unknown as CalendarData;
      if (rec && rec.id === '') return { название: '' } as unknown as CalendarData;
      return null;
    });

    const props = reactive({
      masterCalendarRecord: masterRec,
      localCalendarRecords: [localRec1, localRec2, localRecNull],
      getLocalDateForCal: vi.fn(),
      updateFromLocalDate: vi.fn(),
      getDateMeta: vi.fn()
    }) as unknown as TimeAtlasBridgeTabProps;

    const tab = useTimeAtlasBridgeTab(props);
    expect(tab.masterCalData.value).toEqual(sampleCal);
    expect(tab.localCalsWithData.value).toEqual([
      { id: 'cal:1', name: 'Локальный', data: { название: 'Локальный' } },
      { id: '', name: 'Календарь', data: { название: '' } }
    ]);

    props.masterCalendarRecord = null;
    expect(tab.masterCalData.value).toBeNull();

    logSpy.mockRestore();
  });

  it('handles era, year, month, and day changes with era year clamping', () => {
    const getLocalDateForCal = vi.fn(() => ({ era_index: 0, year: 150, month: 2, day: 10 }));
    const updateFromLocalDate = vi.fn();

    const tab = useTimeAtlasBridgeTab({
      masterCalendarRecord: null,
      localCalendarRecords: [],
      getLocalDateForCal,
      updateFromLocalDate,
      getDateMeta: vi.fn()
    });

    // Era 1 has range [300, 400]; current year 150 clamps up to 300
    tab.onEraChange(sampleCal, { target: { value: '1' } } as unknown as Event);
    expect(updateFromLocalDate).toHaveBeenLastCalledWith(sampleCal, {
      era_index: 1,
      year: 300,
      month: 2,
      day: 10
    });

    // Era 0 has range [100, 200]; year 500 clamps down to 200
    getLocalDateForCal.mockReturnValueOnce({ era_index: 1, year: 500, month: 2, day: 10 });
    tab.onEraChange(sampleCal, { target: { value: '0' } } as unknown as Event);
    expect(updateFromLocalDate).toHaveBeenLastCalledWith(sampleCal, {
      era_index: 0,
      year: 200,
      month: 2,
      day: 10
    });

    // Missing era leaves year unchanged
    tab.onEraChange(sampleCal, { target: { value: '99' } } as unknown as Event);
    expect(updateFromLocalDate).toHaveBeenLastCalledWith(sampleCal, {
      era_index: 99,
      year: 150,
      month: 2,
      day: 10
    });

    tab.onYearChange(sampleCal, { target: { value: '175' } } as unknown as Event);
    expect(updateFromLocalDate).toHaveBeenLastCalledWith(sampleCal, {
      era_index: 0,
      year: 175,
      month: 2,
      day: 10
    });

    tab.onMonthChange(sampleCal, { target: { value: '5' } } as unknown as Event);
    expect(updateFromLocalDate).toHaveBeenLastCalledWith(sampleCal, {
      era_index: 0,
      year: 150,
      month: 5,
      day: 10
    });

    tab.onDayChange(sampleCal, { target: { value: '22' } } as unknown as Event);
    expect(updateFromLocalDate).toHaveBeenLastCalledWith(sampleCal, {
      era_index: 0,
      year: 150,
      month: 2,
      day: 22
    });
  });
});


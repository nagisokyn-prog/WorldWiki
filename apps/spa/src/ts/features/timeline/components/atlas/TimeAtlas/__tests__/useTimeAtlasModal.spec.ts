import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTimeAtlasModal } from '../useTimeAtlasModal';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';

vi.mock('@/stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      {
        id: 'cal_master',
        is_master: true,
        data: {
          ...CalendarMath.getDefaultCalendar(),
          название: 'Календарь Мира',
          is_master: true,
        },
      },
      {
        id: 'cal_local',
        is_master: false,
        data: {
          название: 'Племя Луны',
          дней_в_неделе: 7,
          названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
          первый_месяц_года: 0,
          месяцы: [{ название: 'Луна 1', дней: 30 }],
          эпохи: [{ название: 'Эпоха 1', год_начала: 1, год_конца: 100 }],
          правило_високосного_года: 'нет',
          праздники: [{ название: 'Праздник Луны', дата_начала: { месяц: 0, день: 1 } }],
          sync_anchor: {
            linked_to_master: true,
            local_anchor_date: { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 },
            master_anchor_date: { era_index: 0, year: 100, month: 0, day: 1, hour: 0, minute: 0 },
          },
        },
      },
    ]),
  }),
}));

describe('useTimeAtlasModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });
  it('loads calendars and provides cross-calendar synchronization in converter and matrix', async () => {
    const emit = vi.fn();
    const atlas = useTimeAtlasModal({ project: 'test-proj', isOpen: true }, emit);

    await new Promise((r) => setTimeout(r, 10));

    expect(atlas.allCalendars.value.length).toBe(2);
    expect(atlas.masterCalendar.value).toBeDefined();

    // Set local date to 1st year 1st month 1st day
    const localCal = atlas.getCalendarById('cal_local')!;
    atlas.updateFromLocalDate(localCal, { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 });

    // Master date should be 100th year
    const masterDate = atlas.getLocalDateForCal(atlas.masterCalendar.value!);
    expect(masterDate.year).toBe(100);

    // Active alignments should detect holiday
    expect(atlas.activeAlignments.value.length).toBeGreaterThan(0);
    expect(atlas.activeAlignments.value[0].text).toContain('Праздник Луны');

    // Matrix grid days
    atlas.matrixBaseCalId.value = 'cal_local';
    atlas.matrixCompareCalId.value = 'cal_master';
    expect(atlas.matrixGridDays.value.length).toBe(30);

    // Snippets
    expect(atlas.snippetFormats.value.length).toBeGreaterThan(0);
  });

  it('computes world time snapshot and literary snippet for configured regions', async () => {
    const emit = vi.fn();
    const atlas = useTimeAtlasModal({ project: 'test-proj', isOpen: true }, emit);

    await new Promise((r) => setTimeout(r, 10));

    // Настраиваем пояса и регионы в мастер-календаре
    if (atlas.masterCalendar.value) {
      atlas.masterCalendar.value.timezones = [
        { id: 'tz_cap', name: 'Столичный', base_offset_hours: 3.0 },
        { id: 'tz_wst', name: 'Западный', base_offset_hours: -5.0 }
      ];
      atlas.masterCalendar.value.regions = [
        { id: 'reg_1', name: 'Столица', timezone_id: 'tz_cap', latitude: 45, longitude: 45 },
        { id: 'reg_2', name: 'Западный Порт', timezone_id: 'tz_wst', latitude: 30, longitude: -75 }
      ];
    }

    atlas.activeTab.value = 'world_time';
    expect(atlas.worldTimeSnapshot.value.length).toBe(2);

    const capSnapshot = atlas.worldTimeSnapshot.value.find(s => s.region.name === 'Столица');
    expect(capSnapshot).toBeDefined();
    expect(capSnapshot?.offsetHours).toBe(3.0);
    expect(capSnapshot?.sunStatus.phase).toBeDefined();

    expect(atlas.worldTimeSnippet.value).toContain('Столица');
    expect(atlas.worldTimeSnippet.value).toContain('Западный Порт');
  });

  it('navigates matrix months, selects matrix day, and copies snippets', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const emit = vi.fn();
    const atlas = useTimeAtlasModal({ project: 'test-proj', isOpen: true }, emit);
    await vi.advanceTimersByTimeAsync(20);

    // Without base cal, prev/next are no-op
    atlas.matrixBaseCalId.value = '';
    atlas.prevMatrixMonth();
    atlas.nextMatrixMonth();
    expect(atlas.matrixDaysCount.value).toBe(30);

    // With base cal (1 month in cal_local)
    atlas.matrixBaseCalId.value = 'cal_local';
    atlas.matrixYear.value = 10;
    atlas.matrixMonth.value = 0;
    atlas.prevMatrixMonth();
    expect(atlas.matrixYear.value).toBe(9);
    atlas.nextMatrixMonth();
    expect(atlas.matrixYear.value).toBe(10);

    // Multi-month calendar (cal_master has 12 months)
    atlas.matrixBaseCalId.value = 'cal_master';
    atlas.matrixMonth.value = 1;
    atlas.prevMatrixMonth();
    expect(atlas.matrixMonth.value).toBe(0);
    atlas.nextMatrixMonth();
    expect(atlas.matrixMonth.value).toBe(1);

    atlas.selectMatrixDay(9999);
    expect(atlas.currentWorldMinute.value).toBe(9999);

    await atlas.copySnippet('Test Date', 0);
    expect(writeText).toHaveBeenCalledWith('Test Date');
    expect(atlas.copiedIdx.value).toBe(0);
    vi.advanceTimersByTime(2100);
    expect(atlas.copiedIdx.value).toBeNull();

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

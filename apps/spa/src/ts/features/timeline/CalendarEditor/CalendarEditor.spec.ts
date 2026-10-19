import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCalendarEditor } from './useCalendarEditor';

const mockGetCalendars = vi.fn();
const mockSaveCalendar = vi.fn();
const mockDeleteCalendar = vi.fn();

vi.mock('@/stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: (...args: any[]) => mockGetCalendars(...args),
    saveCalendar: (...args: any[]) => mockSaveCalendar(...args),
    deleteCalendar: (...args: any[]) => mockDeleteCalendar(...args),
  }),
}));

describe('useCalendarEditor', () => {
  const props = {
    calendarId: 'cal_1',
    projectId: 'proj_test',
    planetId: 'earth',
    isReadOnly: false,
  };

  const mockCalendarRecord = {
    id: 'cal_1',
    name: 'Григорианский',
    is_default: true,
    is_master: true,
    data: {
      название: 'Григорианский',
      месяцы: [
        { название: 'Январь', дней: 31 },
        { название: 'Февраль', дней: 28 },
      ],
      дней_вне_месяцев: 0,
      сезоны: [{ название: 'Зима' }],
      эпохи: [{ название: 'Н.Э.' }],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCalendars.mockResolvedValue([mockCalendarRecord]);
    mockSaveCalendar.mockResolvedValue(true);
    mockDeleteCalendar.mockResolvedValue(true);
  });

  it('loads calendar data and initializes tabs', async () => {
    const emit = vi.fn() as any;
    const editor = useCalendarEditor(props, emit);

    await editor.loadCalendar();

    expect(editor.calendarRecord.value?.name).toBe('Григорианский');
    expect(editor.tabsList.value.length).toBe(5);
    expect(editor.activeTab.value).toBe('structure');
    expect(editor.totalDays.value).toBe(59);
  });

  it('switches tabs correctly', () => {
    const emit = vi.fn() as any;
    const editor = useCalendarEditor(props, emit);

    expect(editor.activeTab.value).toBe('structure');
    editor.setTab('astronomy');
    expect(editor.activeTab.value).toBe('astronomy');
    editor.setTab('reformsDst');
    expect(editor.activeTab.value).toBe('reformsDst');
  });

  it('updates calendar name and patches data', async () => {
    const emit = vi.fn() as any;
    const editor = useCalendarEditor(props, emit);
    await editor.loadCalendar();

    editor.updateName('Новое Название');
    expect(editor.calendarRecord.value?.name).toBe('Новое Название');
    expect(emit).toHaveBeenCalledWith('update:calendar', expect.any(Object));

    editor.patchCalendarData({ дней_вне_месяцев: 5 });
    expect(editor.calData.value?.дней_вне_месяцев).toBe(5);
  });

  it('saves calendar and emits save event', async () => {
    const emit = vi.fn() as any;
    const editor = useCalendarEditor(props, emit);
    await editor.loadCalendar();

    await editor.saveCalendar();
    expect(mockSaveCalendar).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('save', expect.any(Object));
  });

  it('deletes calendar and emits delete event', async () => {
    const emit = vi.fn() as any;
    const editor = useCalendarEditor(props, emit);
    await editor.loadCalendar();

    await editor.deleteCalendar();
    expect(mockDeleteCalendar).toHaveBeenCalledWith('cal_1');
    expect(emit).toHaveBeenCalledWith('delete', 'cal_1');
  });

  it('opens and closes audit modal', async () => {
    const emit = vi.fn() as any;
    const editor = useCalendarEditor(props, emit);
    await editor.loadCalendar();

    expect(editor.isAuditModalOpen.value).toBe(false);
    editor.openAuditModal();
    expect(editor.isAuditModalOpen.value).toBe(true);
    expect(emit).toHaveBeenCalledWith('audit', 'cal_1');

    editor.closeAuditModal();
    expect(editor.isAuditModalOpen.value).toBe(false);
  });
});

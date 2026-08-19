import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCalendarsPanel } from '../useCalendarsPanel';

let mockCalendarsState: any[] = [];

const mockGetCalendars = vi.fn().mockImplementation(async () => mockCalendarsState);
const mockSaveCalendar = vi.fn().mockImplementation(async (_proj, payload) => {
  const existing = mockCalendarsState.find((c) => c.id === payload.id);
  if (existing) {
    existing.is_default = payload.is_default;
    existing.data = payload;
  } else {
    mockCalendarsState.push({
      id: payload.id || `c_${Date.now()}`,
      is_default: payload.is_default,
      data: payload,
    });
  }
  return true;
});
const mockDeleteCalendar = vi.fn().mockImplementation(async (id) => {
  mockCalendarsState = mockCalendarsState.filter((c) => c.id !== id);
  return true;
});

vi.mock('../../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: mockGetCalendars,
    saveCalendar: mockSaveCalendar,
    deleteCalendar: mockDeleteCalendar,
  }),
}));

vi.mock('@worldwiki/components', () => ({
  appConfirm: vi.fn().mockResolvedValue(true),
  appAlert: vi.fn(),
}));

describe('useCalendarsPanel', () => {
  let props: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCalendarsState = [
      { id: 'c1', is_default: true, data: { название: 'Default' } },
    ];
    props = { project: 'p1' };
  });

  it('manages expand and loads calendars', async () => {
    const panel = useCalendarsPanel(props);

    await Promise.resolve();

    expect(panel.isExpanded(0)).toBe(true);

    panel.toggleExpand(0);
    expect(panel.isExpanded(0)).toBe(false);

    panel.toggleExpand(0);
    expect(panel.isExpanded(0)).toBe(true);
  });

  it('handles auto-creation when no calendars exist', async () => {
    mockGetCalendars.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 'c_new', is_default: true, data: { название: 'Auto' } },
    ]);

    useCalendarsPanel({ project: 'p1' });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockSaveCalendar).toHaveBeenCalled();
  });

  it('adds, saves, removes and sets default calendars', async () => {
    mockCalendarsState = [
      { id: 'c1', is_default: true, data: { название: 'Cal 1' } },
      { id: 'c2', is_default: false, data: { название: 'Cal 2' } },
    ];

    const panel = useCalendarsPanel(props);
    await Promise.resolve();

    // addCalendar
    await panel.addCalendar();
    expect(mockSaveCalendar).toHaveBeenCalled();

    // saveCalendar
    await panel.saveCalendar(0);
    expect(mockSaveCalendar).toHaveBeenCalled();

    // setDefault
    await panel.setDefault(1);
    expect(mockSaveCalendar).toHaveBeenCalled();

    // saveAll
    await panel.saveAll();

    // removeCalendar
    await panel.removeCalendar(0);
    expect(mockDeleteCalendar).toHaveBeenCalledWith('c1');
  });

  it('handles empty project gracefully', async () => {
    const panel = useCalendarsPanel({ project: '' });
    await Promise.resolve();
    expect(panel.calendars.value).toEqual([]);

    await panel.addCalendar();
    await panel.saveCalendar(0);
    await panel.removeCalendar(0);
  });
});

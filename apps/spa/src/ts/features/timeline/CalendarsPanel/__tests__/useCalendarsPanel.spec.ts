import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCalendarsPanel } from '../useCalendarsPanel';
import { useCalendarStore } from '../../../stores/calendar.store';

vi.mock('../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      { id: 'c1', is_default: true, data: { название: 'Default' } },
    ]),
    saveCalendar: vi.fn(),
  }),
}));

describe('useCalendarsPanel', () => {
  let props: any;

  beforeEach(() => {
    vi.clearAllMocks();
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
});

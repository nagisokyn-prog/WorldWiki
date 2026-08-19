import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTimelinePanel } from '../useTimelinePanel';

vi.mock('../../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      {
        id: 'cal1',
        data: {
          название: 'Main Calendar',
          месяцы: [{ название: 'Январь', дней: 30 }],
          эпохи: [{ название: 'Эра 1', год_начала: 1, год_конца: 1000 }],
        },
      },
    ]),
  }),
}));

vi.mock('@worldwiki/components', () => ({
  settingsService: {
    getSettings: () => ({ dropdowns: { wheelOrientation: 'horizontal' } }),
  },
}));

describe('useTimelinePanel', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emit = vi.fn();
    props = {
      project: 'p1',
      events: [
        {
          date: { era: 0, year: 100, month: 0, day: 15 },
          description: 'Great War',
          calendar_id: 'cal1',
        },
      ],
    };
  });

  it('manages expanded events and options', () => {
    const panel = useTimelinePanel(props, emit);

    expect(panel.isExpanded(0)).toBe(false);

    panel.toggleExpand(0);
    expect(panel.isExpanded(0)).toBe(true);

    panel.toggleExpand(0);
    expect(panel.isExpanded(0)).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGlobalCalendarWidget } from '../useGlobalCalendarWidget';
import { useCalendarStore } from '../../../../stores/calendar.store';

vi.mock('../../../../stores/calendar.store', () => ({
  useCalendarStore: () => ({
    getCalendars: vi.fn().mockResolvedValue([
      {
        id: 'cal_master',
        is_master: true,
        data: {
          название: 'Мастер Календарь',
          месяцы: [{ название: 'Январь', дней: 30 }],
          эпохи: [{ год_начала: 1, год_конца: 1000 }],
        },
      },
      {
        id: 'cal_local',
        is_master: false,
        data: {
          название: 'Местный Календарь',
          месяцы: [{ название: 'М1', дней: 30 }],
          эпохи: [{ год_начала: 1, год_конца: 1000 }],
        },
      },
    ]),
  }),
}));

describe('useGlobalCalendarWidget', () => {
  let props: any;

  beforeEach(() => {
    props = { project: 'my-proj' };
  });

  it('computes master date and local date', async () => {
    const widget = useGlobalCalendarWidget(props);

    // Give store mock time to resolve onMounted
    await Promise.resolve();

    expect(widget.currentMasterInput.value.year).toBe(1);
    expect(widget.currentAbsoluteMinute.value).toBeDefined();
  });
});

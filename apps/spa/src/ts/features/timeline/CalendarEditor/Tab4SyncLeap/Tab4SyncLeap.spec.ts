import { describe, it, expect, vi } from 'vitest';
import { useTab4SyncLeap } from './useTab4SyncLeap';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab4SyncLeap', () => {
  const mockCalendar: CalendarData = {
    название: 'Sync Leap Calendar',
    високос_настройки: {
      тип_правила: 'григорианское',
      интервал: 4,
      дней_добавлять: 1,
    },
    часовые_пояса: [
      { название: 'UTC', смещение_минут: 0 },
    ],
  };

  it('computes leap settings and timezones', () => {
    const emit = vi.fn();
    const { leapSettings, timezones } = useTab4SyncLeap(
      { calendarData: mockCalendar },
      emit
    );

    expect(leapSettings.value.тип_правила).toBe('григорианское');
    expect(timezones.value.length).toBe(1);
  });

  it('changes rule type and emits update', () => {
    const emit = vi.fn();
    const { setRuleType } = useTab4SyncLeap(
      { calendarData: mockCalendar },
      emit
    );

    setRuleType('каждый 4 год');
    expect(emit).toHaveBeenCalledWith('update', {
      високос_настройки: {
        тип_правила: 'каждый 4 год',
        интервал: 4,
        дней_добавлять: 1,
      },
    });
  });

  it('updates sync anchor', () => {
    const emit = vi.fn();
    const { updateSyncAnchor } = useTab4SyncLeap(
      { calendarData: mockCalendar },
      emit
    );

    updateSyncAnchor({ master_calendar_id: 'master_123' });
    expect(emit).toHaveBeenCalledWith('update', {
      sync_anchor: {
        master_calendar_id: 'master_123',
      },
    });
  });
});

import { describe, it, expect } from 'vitest';
import { reactive } from 'vue';
import { useCalendarSyncAnchor } from '../useCalendarSyncAnchor';
import { CalendarMath } from '../../../../../services/Calendars/calendar.math';
import type { CalendarData } from '../../../../../services/Calendars/calendar.types';

describe('useCalendarSyncAnchor', () => {
  const masterCal: CalendarData = {
    ...CalendarMath.getDefaultCalendar(),
    is_master: true,
  };

  it('initializes sync_anchor if absent and tracks reactive link state', () => {
    const localCal = reactive<CalendarData>({
      название: 'Племя',
      дней_в_неделе: 5,
      названия_дней_недели: ['А', 'Б', 'В', 'Г', 'Д'],
      первый_месяц_года: 0,
      месяцы: [{ название: 'М1', дней: 30 }],
      эпохи: [{ название: 'Э1', год_начала: 1, год_конца: 100 }],
      правило_високосного_года: 'нет',
    });

    const { isLinked, anchor, localAnchorDate, masterAnchorDate, offsetDescription } = useCalendarSyncAnchor({
      modelValue: localCal,
      masterCalendar: masterCal,
    });

    expect(anchor.value).toBeDefined();
    expect(isLinked.value).toBe(true);
    expect(localAnchorDate.value.year).toBe(1);
    expect(masterAnchorDate.value.year).toBe(1);
    expect(offsetDescription.value).toContain('Смещение: +0 дн.');

    // Toggle link off
    isLinked.value = false;
    expect(offsetDescription.value).toContain('Синхронизация отключена');
  });

  it('computes offset description correctly when anchor dates are shifted', () => {
    const localCal: CalendarData = {
      название: 'Племя',
      дней_в_неделе: 5,
      названия_дней_недели: ['А', 'Б', 'В', 'Г', 'Д'],
      первый_месяц_года: 0,
      месяцы: [{ название: 'М1', дней: 30 }],
      эпохи: [{ название: 'Э1', год_начала: 1, год_конца: 100 }],
      правило_високосного_года: 'нет',
      sync_anchor: {
        linked_to_master: true,
        local_anchor_date: { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 },
        master_anchor_date: { era_index: 0, year: 10, month: 0, day: 1, hour: 0, minute: 0 },
      },
    };

    const { offsetDescription } = useCalendarSyncAnchor({
      modelValue: localCal,
      masterCalendar: masterCal,
    });

    expect(offsetDescription.value).toContain('Смещение: +');
    expect(offsetDescription.value).toContain('дн.');
  });
});

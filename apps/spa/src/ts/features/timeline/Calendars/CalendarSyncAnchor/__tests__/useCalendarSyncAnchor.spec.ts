import { describe, it, expect } from 'vitest';
import { reactive } from 'vue';
import { useCalendarSyncAnchor } from '../useCalendarSyncAnchor';
import { CalendarMath } from '../../../../../services/Calendars/useCalendarEngine';
import type { CalendarData } from '../CalendarSyncAnchor.model';

describe('useCalendarSyncAnchor', () => {
  const masterCal: CalendarData = {
    ...CalendarMath.getDefaultCalendar(),
    is_master: true,
    эпохи: [
      { название: 'Основание Империи', год_начала: 1200, год_конца: 2000 },
      { название: 'Великий Исход', год_начала: 500, год_конца: 1199 },
    ],
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
    expect(offsetDescription.value).toContain('Летоисчисление культуры началось одновременно с основанием Календаря Мира');
  });

  it('computes offset and year correctly when selecting master era', () => {
    const localCal = reactive<CalendarData>({
      название: 'Дварфы',
      дней_в_неделе: 7,
      названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      первый_месяц_года: 0,
      месяцы: [{ название: 'Горн', дней: 30 }],
      эпохи: [{ название: 'Первая Твердыня', год_начала: 1 }],
      правило_високосного_года: 'нет',
    });

    const hook = useCalendarSyncAnchor({
      modelValue: localCal,
      masterCalendar: masterCal,
    });

    // Select era "Основание Империи" (idx 0, starts at 1200)
    hook.selectedMasterEraIndex.value = 0;
    hook.syncDirection.value = 'after';
    hook.offsetYears.value = 50;
    hook.updateMasterYearFromState();

    expect(hook.masterAnchorDate.value.year).toBe(1250);
    expect(hook.offsetDescription.value).toContain('через 50 лет после эпохи «Основание Империи»');

    // Direction "before" 1290 years before empire founding
    hook.syncDirection.value = 'before';
    hook.offsetYears.value = 1290;
    hook.updateMasterYearFromState();

    expect(hook.masterAnchorDate.value.year).toBe(1200 - 1290);
    expect(hook.offsetDescription.value).toContain('за 1290 лет до эпохи «Основание Империи»');
  });

  it('maintains backwards compatibility for masterStartYear setter', () => {
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

    const { masterStartYear, offsetDescription } = useCalendarSyncAnchor({
      modelValue: localCal,
      masterCalendar: masterCal,
    });

    expect(masterStartYear.value).toBe(10);
    expect(offsetDescription.value).toContain('1-й год культуры наступил в 10 году Календаря Мира');
  });
});

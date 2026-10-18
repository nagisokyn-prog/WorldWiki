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

  it('syncs correctly with master calendar anchor event', () => {
    const masterWithEvents: CalendarData = {
      ...masterCal,
      anchor_events: [
        { id: 'evt-nativity', name: 'Рождество', year: 0, day: 25, month: 11 },
        { id: 'evt-fall', name: 'Падение Империи', year: 1000, day: 1, month: 0 },
      ],
    };

    const localCal = reactive<CalendarData>({
      название: 'Новое Королевство',
      дней_в_неделе: 7,
      названия_дней_недели: ['1', '2', '3', '4', '5', '6', '7'],
      первый_месяц_года: 0,
      месяцы: [{ название: 'М1', дней: 30 }],
      эпохи: [{ название: 'Э1', год_начала: 1 }],
      правило_високосного_года: 'нет',
    });

    const hook = useCalendarSyncAnchor({
      modelValue: localCal,
      masterCalendar: masterWithEvents,
    });

    hook.syncTargetType.value = 'event';
    hook.selectedEventId.value = 'evt-fall';
    hook.syncDirection.value = 'after';
    hook.offsetYears.value = 45;
    hook.updateMasterYearFromState();

    expect(hook.masterAnchorDate.value.year).toBe(1045);
    expect(hook.offsetDescription.value).toContain('через 45 лет после события «Падение Империи»');

    // Before event
    hook.syncDirection.value = 'before';
    hook.offsetYears.value = 10;
    hook.updateMasterYearFromState();
    expect(hook.masterAnchorDate.value.year).toBe(990);
    expect(hook.offsetDescription.value).toContain('за 10 лет до события «Падение Империи»');
  });

  it('syncs correctly with another settlement calendar', () => {
    const settlement2: CalendarData = {
      _id: 'cal-settlement-2',
      название: 'Поселение Древних',
      дней_в_неделе: 7,
      названия_дней_недели: ['1', '2', '3', '4', '5', '6', '7'],
      первый_месяц_года: 0,
      месяцы: [{ название: 'М1', дней: 30 }],
      эпохи: [{ название: 'Первые века', год_начала: 1 }],
      правило_високосного_года: 'нет',
      sync_anchor: {
        linked_to_master: true,
        local_anchor_date: { era_index: 0, year: 1, month: 0, day: 1, hour: 0, minute: 0 },
        master_anchor_date: { era_index: 0, year: 500, month: 0, day: 1, hour: 0, minute: 0 },
      },
    };

    const settlement1 = reactive<CalendarData>({
      _id: 'cal-settlement-1',
      название: 'Поселение Молодых',
      дней_в_неделе: 7,
      названия_дней_недели: ['1', '2', '3', '4', '5', '6', '7'],
      первый_месяц_года: 0,
      месяцы: [{ название: 'М1', дней: 30 }],
      эпохи: [{ название: 'Основание колонии', год_начала: 1 }],
      правило_високосного_года: 'нет',
    });

    const hook = useCalendarSyncAnchor({
      modelValue: settlement1,
      masterCalendar: masterCal,
      availableCalendars: [settlement2, settlement1],
    });

    hook.syncTargetType.value = 'calendar';
    hook.selectedCalendarId.value = 'cal-settlement-2';
    hook.targetCalendarYear.value = 2450;
    hook.updateMasterYearFromState();

    // Year 500 + (2450 - 1) = 2949
    expect(hook.masterAnchorDate.value.year).toBe(2949);
    expect(hook.offsetDescription.value).toContain('когда у поселения «Поселение Древних» шёл 2450-й год');
  });

  it('allows quick-adding an anchor event to master calendar directly from hook', () => {
    const mutableMaster: CalendarData = {
      ...masterCal,
      anchor_events: [],
    };

    const localCal = reactive<CalendarData>({
      название: 'Колония',
      дней_в_неделе: 7,
      названия_дней_недели: ['1', '2', '3', '4', '5', '6', '7'],
      первый_месяц_года: 0,
      месяцы: [{ название: 'М1', дней: 30 }],
      эпохи: [{ название: 'Э1', год_начала: 1 }],
      правило_високосного_года: 'нет',
    });

    const hook = useCalendarSyncAnchor({
      modelValue: localCal,
      masterCalendar: mutableMaster,
    });

    hook.quickAddMasterEvent();

    expect(mutableMaster.anchor_events?.length).toBe(1);
    expect(hook.selectedEventId.value).toBe(mutableMaster.anchor_events![0].id);
    expect(hook.selectedMasterEvent.value).toBeDefined();
    expect(hook.selectedMasterEvent.value?.name).toContain('Опорное историческое событие 1');
  });
});


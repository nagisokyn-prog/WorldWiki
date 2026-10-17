import { ref, computed, watch } from 'vue';
import { CalendarMath, useCalendarEngine } from '../../../../services/Calendars/useCalendarEngine';
import type { CalendarData, CalendarEra, CalendarMonth, SyncAnchorDate } from '../../../../services/Calendars/calendar.types';

export function useCalendarSyncAnchor(props: {
  modelValue: CalendarData;
  masterCalendar?: CalendarData | null;
}) {
  const isCollapsed = ref(false);

  const initAnchor = () => {
    if (!props.modelValue.sync_anchor) {
      props.modelValue.sync_anchor = {
        linked_to_master: true,
        local_anchor_date: {
          era_index: 0,
          year: 1,
          month: 0,
          day: 1,
          hour: 0,
          minute: 0,
        },
        master_anchor_date: {
          era_index: 0,
          year: 1,
          month: 0,
          day: 1,
          hour: 0,
          minute: 0,
        },
      };
    } else {
      if (!props.modelValue.sync_anchor.local_anchor_date) {
        props.modelValue.sync_anchor.local_anchor_date = {
          era_index: 0,
          year: 1,
          month: 0,
          day: 1,
          hour: 0,
          minute: 0,
        };
      }
      if (!props.modelValue.sync_anchor.master_anchor_date) {
        props.modelValue.sync_anchor.master_anchor_date = {
          era_index: 0,
          year: 1,
          month: 0,
          day: 1,
          hour: 0,
          minute: 0,
        };
      }
    }
  };

  const internalLinked = ref(props.modelValue.sync_anchor?.linked_to_master ?? true);

  watch(() => props.modelValue, () => {
    initAnchor();
    if (props.modelValue.sync_anchor?.linked_to_master !== undefined) {
      internalLinked.value = props.modelValue.sync_anchor.linked_to_master;
    }
  }, { immediate: true });

  const anchor = computed(() => props.modelValue.sync_anchor!);

  const isLinked = computed({
    get: () => internalLinked.value,
    set: (val: boolean) => {
      internalLinked.value = val;
      initAnchor();
      if (props.modelValue.sync_anchor) {
        props.modelValue.sync_anchor.linked_to_master = val;
      }
    },
  });

  const localEras = computed<CalendarEra[]>(() => props.modelValue.эпохи || []);
  const localMonths = computed<CalendarMonth[]>(() => props.modelValue.месяцы || []);

  const masterEras = computed<CalendarEra[]>(() => props.masterCalendar?.эпохи || []);
  const masterMonths = computed<CalendarMonth[]>(() => props.masterCalendar?.месяцы || []);

  const localAnchorDate = computed<SyncAnchorDate>(() => anchor.value.local_anchor_date!);
  const masterAnchorDate = computed<SyncAnchorDate>(() => anchor.value.master_anchor_date!);

  const localMaxDays = computed(() => {
    return CalendarMath.getDaysInMonth(
      props.modelValue,
      localAnchorDate.value.year,
      localAnchorDate.value.month
    );
  });

  const masterMaxDays = computed(() => {
    if (!props.masterCalendar) return 31;
    return CalendarMath.getDaysInMonth(
      props.masterCalendar,
      masterAnchorDate.value.year,
      masterAnchorDate.value.month
    );
  });

  const masterStartYear = computed({
    get: () => masterAnchorDate.value.year,
    set: (y: number) => {
      masterAnchorDate.value.year = Number(y) || 1;
    },
  });

  const showAdvanced = ref(false);

  const offsetDescription = computed(() => {
    if (!isLinked.value) return 'Синхронизация отключена (календари не связаны)';
    if (!props.masterCalendar) return 'Календарь Мира не найден';

    const startYear = masterStartYear.value;
    if (startYear === 1 && masterAnchorDate.value.month === 0 && masterAnchorDate.value.day === 1) {
      return 'Летоисчисление культуры началось одновременно с основанием Календаря Мира (1 год).';
    }

    if (startYear > 1) {
      const masterMonthName = masterMonths.value[masterAnchorDate.value.month]?.название || '';
      return `1-й год культуры наступил в ${startYear} году Календаря Мира (${masterAnchorDate.value.day} ${masterMonthName}).`;
    }

    const yearsBefore = Math.abs(startYear) + 1;
    return `Летоисчисление культуры началось за ${yearsBefore} г. до Календаря Мира.`;
  });

  const linkedAnchorWorldDay = computed(() => {
    if (!props.masterCalendar || !isLinked.value) return 0;
    const engine = useCalendarEngine();
    const toCulture = (cal: CalendarData) => ({
      planet_id: cal._id || 'world',
      ticks_per_day: (cal.настройки_времени?.часов_в_сутках || 24) * 3600,
      day_start_offset: 0,
      base_year_days: cal.месяцы?.reduce((a, m) => a + (m.дней || 0), 0) || 365,
      regular_months: cal.месяцы?.map((m) => m.дней || 30) || [30],
      harmonics: [
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
        { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
      ],
      leap_target: { InMonth: { target_month: cal.пользовательское_високосное_правило?.месяц ?? 1 } },
      leap_day_offset: cal.пользовательское_високосное_правило?.день_смещения ?? 1,
      calendar_origin_day: 0,
      dial: {
        units: [
          { name: 'Hour', subdivisions: cal.настройки_времени?.часов_в_сутках || 24 },
          { name: 'Minute', subdivisions: cal.настройки_времени?.минут_в_часе || 60 },
        ],
      },
      eras: (cal.эпохи || []).map((e) => ({
        name: e.название || 'Era',
        start_year: e.год_начала ?? 1,
        is_count_down: e.обратный_отсчет ?? false,
        counting_mode: 'by_calendar_year' as const,
      })),
    });

    const mCoord = {
      era_index: masterAnchorDate.value.era_index || 0,
      year: masterAnchorDate.value.year || 1,
      month: masterAnchorDate.value.month || 0,
      day: masterAnchorDate.value.day || 1,
      unit_values: [masterAnchorDate.value.hour || 0, masterAnchorDate.value.minute || 0],
    };
    const lCoord = {
      era_index: localAnchorDate.value.era_index || 0,
      year: localAnchorDate.value.year || 1,
      month: localAnchorDate.value.month || 0,
      day: localAnchorDate.value.day || 1,
      unit_values: [localAnchorDate.value.hour || 0, localAnchorDate.value.minute || 0],
    };

    return engine.calculateLinkedAnchorWorldDay(
      mCoord,
      toCulture(props.masterCalendar),
      lCoord,
      toCulture(props.modelValue)
    );
  });

  return {
    isCollapsed,
    isLinked,
    anchor,
    localEras,
    localMonths,
    masterEras,
    masterMonths,
    localAnchorDate,
    masterAnchorDate,
    localMaxDays,
    masterMaxDays,
    masterStartYear,
    showAdvanced,
    offsetDescription,
    linkedAnchorWorldDay,
  };
}

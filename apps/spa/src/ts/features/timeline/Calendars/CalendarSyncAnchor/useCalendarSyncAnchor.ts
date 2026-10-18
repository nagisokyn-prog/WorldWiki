/**
 * @file useCalendarSyncAnchor.ts
 * @description Composable для управления сопряжением летоисчислений культурного календаря
 * с Опорным Календарем Мира без ввода отрицательных чисел.
 */

import { ref, computed, watch } from 'vue';
import { CalendarMath, useCalendarEngine } from '../../../../services/Calendars/useCalendarEngine';
import type {
  CalendarSyncAnchorProps,
  SyncDirection,
  CalendarData,
  CalendarEra,
  CalendarMonth,
  SyncAnchorDate,
} from './CalendarSyncAnchor.model';

export function useCalendarSyncAnchor(props: CalendarSyncAnchorProps) {
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
      props.modelValue.sync_anchor.linked_to_master = true;
    }
  };

  const internalLinked = ref(props.modelValue.sync_anchor?.linked_to_master ?? true);

  const anchor = computed(() => {
    initAnchor();
    return props.modelValue.sync_anchor!;
  });

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

  const selectedMasterEraIndex = ref<number>(-1);
  const syncDirection = ref<SyncDirection>('after');
  const offsetYears = ref<number>(0);

  const syncStateFromMasterYear = () => {
    const curYear = masterAnchorDate.value.year ?? 1;
    const eras = masterEras.value;

    if (eras.length > 0) {
      let chosenEraIdx = -1;
      for (let i = 0; i < eras.length; i++) {
        const era = eras[i];
        const start = era.год_начала ?? 1;
        const end = era.год_конца ?? (start + 1000);
        if (curYear >= start && curYear <= end) {
          chosenEraIdx = i;
          break;
        }
      }

      if (chosenEraIdx >= 0) {
        selectedMasterEraIndex.value = chosenEraIdx;
        const base = eras[chosenEraIdx].год_начала ?? 1;
        if (curYear >= base) {
          syncDirection.value = 'after';
          offsetYears.value = curYear - base;
        } else {
          syncDirection.value = 'before';
          offsetYears.value = base - curYear;
        }
        return;
      }
    }

    selectedMasterEraIndex.value = -1;
    if (curYear >= 1) {
      syncDirection.value = 'after';
      offsetYears.value = curYear - 1;
    } else {
      syncDirection.value = 'before';
      offsetYears.value = 1 - curYear;
    }
  };

  const updateMasterYearFromState = () => {
    const eras = masterEras.value;
    const baseYear = (selectedMasterEraIndex.value >= 0 && eras[selectedMasterEraIndex.value])
      ? (eras[selectedMasterEraIndex.value].год_начала ?? 1)
      : 1;

    const offset = Math.max(0, Number(offsetYears.value) || 0);
    if (syncDirection.value === 'after') {
      masterAnchorDate.value.year = baseYear + offset;
    } else {
      masterAnchorDate.value.year = baseYear - offset;
    }
    masterAnchorDate.value.era_index = selectedMasterEraIndex.value >= 0 ? selectedMasterEraIndex.value : 0;
  };

  watch(
    () => props.modelValue,
    () => {
      initAnchor();
      syncStateFromMasterYear();
    },
    { immediate: true }
  );

  watch(
    () => masterEras.value,
    () => {
      syncStateFromMasterYear();
    }
  );

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
      syncStateFromMasterYear();
    },
  });

  const offsetDescription = computed(() => {
    if (!isLinked.value) return 'Синхронизация отключена (календари не связаны)';
    if (!props.masterCalendar) return 'Календарь Мира не найден';

    const startYear = masterAnchorDate.value.year ?? 1;
    const mDay = masterAnchorDate.value.day || 1;
    const mMonthIdx = masterAnchorDate.value.month || 0;
    const monthName = masterMonths.value[mMonthIdx]?.название || `Месяц ${mMonthIdx + 1}`;

    const eras = masterEras.value;
    const chosenEra = selectedMasterEraIndex.value >= 0 ? eras[selectedMasterEraIndex.value] : null;

    if (chosenEra) {
      const eraName = chosenEra.название || 'Эпоха';
      const offset = offsetYears.value;
      if (offset === 0) {
        return `1-й год культуры наступил точно в год начала эпохи «${eraName}» (${mDay} ${monthName}, ${startYear} г. Мира).`;
      }
      if (syncDirection.value === 'after') {
        return `1-й год культуры наступил через ${offset} лет после эпохи «${eraName}» (${mDay} ${monthName}, ${startYear} г. Мира).`;
      }
      return `1-й год культуры наступил за ${offset} лет до эпохи «${eraName}» (${mDay} ${monthName}, ${startYear} г. Мира).`;
    }

    if (startYear === 1 && mMonthIdx === 0 && mDay === 1) {
      return 'Летоисчисление культуры началось одновременно с основанием Календаря Мира (1 год, 1 день).';
    }

    if (startYear >= 1) {
      return `1-й год культуры наступил в ${startYear} году Календаря Мира (${mDay} ${monthName}).`;
    }

    const yearsBefore = Math.abs(startYear) + 1;
    return `Летоисчисление культуры началось за ${yearsBefore} лет до 1 года Календаря Мира (${mDay} ${monthName}).`;
  });

  const linkedAnchorWorldDay = computed(() => {
    if (!props.masterCalendar || !isLinked.value) return 0;
    const engine = useCalendarEngine();
    const toCulture = (cal: CalendarData) => ({
      planet_id: cal._id || 'world',
      ticks_per_day: (cal.настройки_времени?.часов_в_сутках || 24) * 3600,
      day_start_offset: 0,
      base_year_days: cal.месяцы?.reduce((a: number, m: CalendarMonth) => a + (m.дней || 0), 0) || 365,
      regular_months: cal.месяцы?.map((m: CalendarMonth) => m.дней || 30) || [30],
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
      eras: (cal.эпохи || []).map((e: CalendarEra) => ({
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
    selectedMasterEraIndex,
    syncDirection,
    offsetYears,
    updateMasterYearFromState,
    offsetDescription,
    linkedAnchorWorldDay,
  };
}

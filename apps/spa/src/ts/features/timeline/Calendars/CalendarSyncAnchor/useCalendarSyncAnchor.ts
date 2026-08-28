import { ref, computed, watch } from 'vue';
import { CalendarMath } from '../../../../services/Calendars/calendar.math';
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

  const offsetMinutes = computed(() => {
    if (!isLinked.value || !props.masterCalendar) return 0;
    return CalendarMath.getAnchorOffset(props.modelValue, props.masterCalendar);
  });

  const offsetDescription = computed(() => {
    if (!isLinked.value) return 'Синхронизация отключена (календари не связаны)';
    if (!props.masterCalendar) return 'Календарь Мира не найден';

    const minsInDay =
      (props.masterCalendar.настройки_времени?.часов_в_сутках || 24) *
      (props.masterCalendar.настройки_времени?.минут_в_часе || 60);

    const diffDays = Math.floor(offsetMinutes.value / minsInDay);

    const localMonthName =
      localMonths.value[localAnchorDate.value.month]?.название ||
      `Месяц ${localAnchorDate.value.month + 1}`;
    const masterMonthName =
      masterMonths.value[masterAnchorDate.value.month]?.название ||
      `Месяц ${masterAnchorDate.value.month + 1}`;

    return `День ${localAnchorDate.value.day}, ${localMonthName}, ${localAnchorDate.value.year} г. ↔ День ${masterAnchorDate.value.day}, ${masterMonthName}, ${masterAnchorDate.value.year} г. (Смещение: ${diffDays >= 0 ? '+' : ''}${diffDays} дн.)`;
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
    offsetDescription,
  };
}

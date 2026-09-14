import { computed } from 'vue';
import type { CalendarData, WorldTimezone, WorldRegion } from '../../../../services/Calendars/calendar.types';

export function useCalendarTimezones(
  props: { modelValue: CalendarData },
  emit: (event: 'update:modelValue', value: CalendarData) => void
) {
  // Часовые пояса мира
  const timezones = computed(() => {
    if (props.modelValue.timezones && Array.isArray(props.modelValue.timezones)) {
      return props.modelValue.timezones;
    }
    // Автоматическая миграция из старых timezone_regions, если timezones еще не инициализирован
    if (props.modelValue.timezone_regions && Array.isArray(props.modelValue.timezone_regions)) {
      return props.modelValue.timezone_regions.map((tr) => ({
        id: tr.id,
        name: tr.name,
        code: tr.name.slice(0, 3).toUpperCase(),
        base_offset_hours: (tr.offset_minutes || 0) / 60
      }));
    }
    return [];
  });

  // Географические регионы мира
  const regions = computed(() => props.modelValue.regions || []);

  // Для обратной совместимости со старыми компонентами и тестами
  const timezoneRegions = computed(() => props.modelValue.timezone_regions || []);

  const dayLengthAnchor = computed({
    get: () => {
      if (!props.modelValue.day_length_anchor) {
        return { summer_solstice_hours: 16, winter_solstice_hours: 8 };
      }
      return props.modelValue.day_length_anchor;
    },
    set: (val) => {
      emit('update:modelValue', {
        ...props.modelValue,
        day_length_anchor: val
      });
    }
  });

  const enableDaylight = computed({
    get: () => props.modelValue.настройки_времени?.учитывать_сезонную_длительность_дня ?? true,
    set: (val: boolean) => {
      const settings = {
        ...(props.modelValue.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60, секунд_в_минуте: 60, широта: 45.0, учитывать_сезонную_длительность_дня: true }),
        учитывать_сезонную_длительность_дня: val
      };
      emit('update:modelValue', {
        ...props.modelValue,
        настройки_времени: settings
      });
    }
  });

  const updateParent = () => {
    const updated: CalendarData = {
      ...props.modelValue,
      timezone_regions: [...timezoneRegions.value]
    };
    if (props.modelValue.timezones !== undefined || timezones.value.length > 0) {
      updated.timezones = [...timezones.value];
    }
    if (props.modelValue.regions !== undefined || regions.value.length > 0) {
      updated.regions = [...regions.value];
    }
    emit('update:modelValue', updated);
  };

  const addTimezone = () => {
    const list: WorldTimezone[] = [...timezones.value];
    const newId = 'tz_' + Date.now();
    list.push({
      id: newId,
      name: `Часовой пояс ${list.length + 1}`,
      code: `Z${list.length + 1}`,
      base_offset_hours: 0
    });

    // Синхронизируем и timezone_regions для совместимости
    const legacy = [...timezoneRegions.value, { id: newId, name: `Часовой пояс ${list.length}`, offset_minutes: 0 }];

    emit('update:modelValue', {
      ...props.modelValue,
      timezones: list,
      timezone_regions: legacy
    });
  };

  const removeTimezone = (idx: number) => {
    const list = [...timezones.value];
    const removed = list.splice(idx, 1)[0];

    // Очищаем привязки у регионов, которые ссылались на удаленный пояс
    const regList = (props.modelValue.regions || []).map((r) => {
      if (removed && r.timezone_id === removed.id) {
        return { ...r, timezone_id: '' };
      }
      return r;
    });

    const legacy = [...timezoneRegions.value];
    if (legacy.length > idx) {
      legacy.splice(idx, 1);
    }

    emit('update:modelValue', {
      ...props.modelValue,
      timezones: list,
      regions: regList,
      timezone_regions: legacy
    });
  };

  const addRegion = () => {
    const regList: WorldRegion[] = [...regions.value];
    const defaultTzId = timezones.value[0]?.id || '';
    regList.push({
      id: 'reg_' + Date.now(),
      name: `Регион ${regList.length + 1}`,
      timezone_id: defaultTzId,
      latitude: 45.0,
      longitude: 0.0,
      summer_day_hours: 16.0,
      winter_day_hours: 8.0
    });

    emit('update:modelValue', {
      ...props.modelValue,
      regions: regList
    });
  };

  const removeRegion = (idx: number) => {
    const regList = [...regions.value];
    regList.splice(idx, 1);

    emit('update:modelValue', {
      ...props.modelValue,
      regions: regList
    });
  };

  // Методы обратной совместимости для старых тестов
  const addTz = () => {
    const tzs = [...timezoneRegions.value];
    tzs.push({
      id: 'tz_' + Date.now(),
      name: 'Новый регион',
      offset_minutes: 0
    });
    emit('update:modelValue', { ...props.modelValue, timezone_regions: tzs });
  };

  const removeTz = (idx: number) => {
    const tzs = [...timezoneRegions.value];
    tzs.splice(idx, 1);
    emit('update:modelValue', { ...props.modelValue, timezone_regions: tzs });
  };

  const minsInHour = computed(() => {
    const s = props.modelValue.настройки_времени || (props.modelValue as { time_settings?: { минут_в_часе?: number } }).time_settings;
    return s?.минут_в_часе || 60;
  });

  const hoursInDay = computed(() => {
    const s = props.modelValue.настройки_времени || (props.modelValue as { time_settings?: { часов_в_сутках?: number } }).time_settings;
    return s?.часов_в_сутках || 24;
  });

  const getSummerHours = (reg: WorldRegion) => Math.floor(reg.summer_day_hours ?? 16);
  const getSummerMinutes = (reg: WorldRegion) => {
    const frac = (reg.summer_day_hours ?? 16) % 1;
    return Math.round(frac * minsInHour.value);
  };

  const setSummerHours = (reg: WorldRegion, h: number) => {
    const m = getSummerMinutes(reg);
    reg.summer_day_hours = Number(h) + (m / minsInHour.value);
    updateParent();
  };

  const setSummerMinutes = (reg: WorldRegion, m: number) => {
    const h = getSummerHours(reg);
    reg.summer_day_hours = h + (Number(m) / minsInHour.value);
    updateParent();
  };

  const getWinterHours = (reg: WorldRegion) => Math.floor(reg.winter_day_hours ?? 8);
  const getWinterMinutes = (reg: WorldRegion) => {
    const frac = (reg.winter_day_hours ?? 8) % 1;
    return Math.round(frac * minsInHour.value);
  };

  const setWinterHours = (reg: WorldRegion, h: number) => {
    const m = getWinterMinutes(reg);
    reg.winter_day_hours = Number(h) + (m / minsInHour.value);
    updateParent();
  };

  const setWinterMinutes = (reg: WorldRegion, m: number) => {
    const h = getWinterHours(reg);
    reg.winter_day_hours = h + (Number(m) / minsInHour.value);
    updateParent();
  };

  return {
    timezones,
    regions,
    timezoneRegions,
    dayLengthAnchor,
    enableDaylight,
    addTimezone,
    removeTimezone,
    addRegion,
    removeRegion,
    updateParent,
    addTz,
    removeTz,
    minsInHour,
    hoursInDay,
    getSummerHours,
    getSummerMinutes,
    setSummerHours,
    setSummerMinutes,
    getWinterHours,
    getWinterMinutes,
    setWinterHours,
    setWinterMinutes
  };
}

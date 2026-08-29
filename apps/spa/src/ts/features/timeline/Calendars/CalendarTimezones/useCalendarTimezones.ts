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
      longitude: 0.0
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

  return {
    timezones,
    regions,
    timezoneRegions,
    addTimezone,
    removeTimezone,
    addRegion,
    removeRegion,
    updateParent,
    addTz,
    removeTz
  };
}

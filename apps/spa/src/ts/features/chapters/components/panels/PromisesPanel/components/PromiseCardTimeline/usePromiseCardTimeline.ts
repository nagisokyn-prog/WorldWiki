import { computed, ref } from 'vue';
import type { DatePrecision, TimeOfDayPreset } from '@/types/narrative';
import type { PromiseCardTimelineProps, PromiseCardTimelineEmits } from './PromiseCardTimeline.model';
import { useTimeJumpPresets, formatTimeJumpLabel, type TimeJumpPreset } from './timeJumpPresets';

/** Вычисляет опции временного контекста, точности, пресетов сдвига и чипов времени суток для карточки сцены. */
export function usePromiseCardTimeline(
  props: PromiseCardTimelineProps,
  emit?: PromiseCardTimelineEmits
) {
  const isJumpPopoverOpen = ref(false);

  const { presets: customPresets, addPreset, removePreset } = useTimeJumpPresets(
    () => props.project || '',
    () => props.currentCalendarId || ''
  );

  const displayPresets = computed(() =>
    customPresets.value.map((p) => ({
      preset: p,
      id: p.id,
      displayLabel: formatTimeJumpLabel(p, props.dialDeltaChips || [])
    }))
  );

  const onApplyJumpOnce = (draft: Omit<TimeJumpPreset, 'id'>) => {
    emit?.('shift-preset', draft);
  };

  const onSaveAndApplyJump = (draft: Omit<TimeJumpPreset, 'id'>) => {
    addPreset(draft, props.dialDeltaChips || []);
    emit?.('shift-preset', draft);
  };

  const onApplySavedPreset = (preset: TimeJumpPreset) => {
    emit?.('shift-preset', preset);
  };

  const timeNatureOptions = [
    { value: 'present', icon: '🎬', label: 'Настоящее' },
    { value: 'flashback', icon: '⏪', label: 'Флешбэк' },
    { value: 'flashforward', icon: '⏩', label: 'Будущее' },
    { value: 'dream', icon: '💭', label: 'Сон' },
  ];

  const timeOfDayOptions: Array<{ value: TimeOfDayPreset; icon: string; title: string }> = [
    { value: 'morning', icon: '🌅', title: 'Утро' },
    { value: 'day', icon: '☀️', title: 'День' },
    { value: 'evening', icon: '🌇', title: 'Вечер' },
    { value: 'night', icon: '🌙', title: 'Ночь' },
  ];

  const precisionOptions = computed<Array<{ value: DatePrecision; label: string }>>(() => {
    const list: Array<{ value: DatePrecision; label: string }> = [
      { value: 'exact', label: 'Точно' },
      { value: 'day', label: 'День' },
      { value: 'month', label: 'Месяц' },
    ];
    if (props.seasonWheelOptions && props.seasonWheelOptions.length > 0) {
      list.push({ value: 'season', label: 'Сезон' });
    }
    list.push({ value: 'year', label: 'Год' });
    list.push({ value: 'range', label: 'Диапазон' });
    return list;
  });

  const calendarWheelOptions = computed(() =>
    (props.calendars || []).map((cal) => ({
      value: cal.id,
      label: cal.data?.название || cal.name || 'Календарь',
    }))
  );

  return {
    isJumpPopoverOpen,
    displayPresets,
    removePreset,
    onApplyJumpOnce,
    onSaveAndApplyJump,
    onApplySavedPreset,
    timeNatureOptions,
    timeOfDayOptions,
    precisionOptions,
    calendarWheelOptions,
  };
}

import { computed } from 'vue';
import type { PromiseCardTimelineProps } from './PromiseCardTimeline.model';

/** Вычисляет опции XboxWheel для временного контекста карточки обещания. */
export function usePromiseCardTimeline(props: PromiseCardTimelineProps) {
  const timeNatureOptions = [
    { value: 'present', label: '🎬 Настоящее (Основной сюжет)' },
    { value: 'flashback', label: '⏪ Флешбэк (Воспоминание)' },
    { value: 'flashforward', label: '🔮 Взгляд в будущее' },
  ];

  const calendarWheelOptions = computed(() =>
    (props.calendars || []).map((cal) => ({
      value: cal.id,
      label: cal.data?.название || cal.name || 'Календарь',
    }))
  );

  return {
    timeNatureOptions,
    calendarWheelOptions,
  };
}

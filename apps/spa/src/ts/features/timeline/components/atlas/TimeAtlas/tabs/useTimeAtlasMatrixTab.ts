import { computed } from 'vue';
import type { TimeAtlasMatrixTabProps } from './TimeAtlasMatrixTab.model';

/** Вычисляет опции XboxWheel для вкладки матрицы Атласа Времени. */
export function useTimeAtlasMatrixTab(props: TimeAtlasMatrixTabProps) {
  const calendarWheelOptions = computed(() =>
    props.allCalendars.map((c) => ({
      value: c.id,
      label: c.data?.название || c.name || 'Календарь',
    }))
  );

  const eraWheelOptions = computed(() =>
    (props.matrixBaseCal?.эпохи || []).map((era, eIdx) => ({
      value: eIdx,
      label: era.название || `Эпоха ${eIdx + 1}`,
    }))
  );

  const monthWheelOptions = computed(() =>
    (props.matrixBaseCal?.месяцы || []).map((m, mIdx) => ({
      value: mIdx,
      label: m.название,
    }))
  );

  return {
    calendarWheelOptions,
    eraWheelOptions,
    monthWheelOptions,
  };
}

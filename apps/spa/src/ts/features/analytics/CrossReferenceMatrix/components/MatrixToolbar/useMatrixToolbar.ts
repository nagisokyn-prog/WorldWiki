import { computed } from 'vue';
import type { MatrixToolbarProps } from './MatrixToolbar.model';

/** Вычисляет опции XboxWheel для панели инструментов матрицы участий. */
export function useMatrixToolbar(props: MatrixToolbarProps) {
  const volumeWheelOptions = computed(() =>
    (props.volumeOptions || []).map((v) => ({ value: v.id, label: `📚 ${v.title}` }))
  );

  const entityTypeWheelOptions = computed(() => [
    { value: 'all', label: 'Все типы' },
    ...props.availableEntityTypes.map((t) => ({ value: t, label: t })),
  ]);

  return {
    volumeWheelOptions,
    entityTypeWheelOptions,
  };
}

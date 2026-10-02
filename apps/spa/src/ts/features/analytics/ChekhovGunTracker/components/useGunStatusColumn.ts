import { computed } from 'vue';
import type { GunStatusColumnProps } from '../ChekhovGunTracker.model';

export function useGunStatusColumn(propsGetter: () => GunStatusColumnProps) {
  const props = computed(() => propsGetter());

  const itemCount = computed(() => props.value.items.length);

  const isEmpty = computed(() => props.value.items.length === 0);

  const emptyText = computed(() => {
    switch (props.value.stateKey) {
      case 'active':
        return 'Нет предметов, активно задействованных в текущих главах';
      case 'sleeping':
        return 'Нет артефактов в режиме ожидания';
      case 'forgotten':
        return 'Отлично! Забытых предметов и невыстреливших ружей не обнаружено';
      case 'destroyed':
        return 'Нет уничтоженных или утерянных предметов';
      default:
        return 'Список пуст';
    }
  });

  return {
    itemCount,
    isEmpty,
    emptyText,
  };
}

import { computed } from 'vue';
import type { GunStatusColumnProps } from '../../ChekhovGunTracker.model';

export function useGunStatusColumn(propsGetter: () => GunStatusColumnProps) {
  const props = computed(() => propsGetter());

  const itemCount = computed(() => props.value.items.length);

  const isEmpty = computed(() => props.value.items.length === 0);

  const emptyText = computed(() => {
    const isGunScope = props.value.scope === 'guns';
    switch (props.value.stateKey) {
      case 'active':
        return isGunScope
          ? 'Нет активных чеховских ружей в текущих главах'
          : 'Нет предметов, активно задействованных в текущих главах';
      case 'sleeping':
        return isGunScope
          ? 'Нет ружей в режиме ожидания выстрела'
          : 'Нет артефактов в режиме ожидания';
      case 'forgotten':
        return isGunScope
          ? 'Отлично! Забытых и невыстреливших ружей не обнаружено'
          : 'Отлично! Забытых предметов не обнаружено';
      case 'destroyed':
        return isGunScope
          ? 'Нет сорванных или снятых ружей'
          : 'Нет уничтоженных или утерянных предметов';
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

import { computed } from 'vue';
import type { ChekhovTrackerToolbarProps, ChekhovTrackerToolbarEmits } from './ChekhovTrackerToolbar.model';
import type { GunTrackerScope } from '../../ChekhovGunTracker.model';

export function useChekhovTrackerToolbar(
  props: ChekhovTrackerToolbarProps,
  emit: ChekhovTrackerToolbarEmits
) {
  const volumeWheelOptions = computed(() =>
    (props.volumeOptions || []).map((v) => ({ value: v.id, label: `📚 ${v.title}` }))
  );

  const itemTypeWheelOptions = computed(() => [
    { value: 'all', label: 'Все категории' },
    ...props.itemTypes.map((t) => ({ value: t, label: t })),
  ]);

  const usageStateWheelOptions = computed(() => {
    const isGuns = props.filter.scope === 'guns';
    return [
      { value: 'all', label: 'Все статусы' },
      { value: 'active', label: isGuns ? '🟢 Заряжено / Выстрелило' : '🟢 В сюжете (активные)' },
      { value: 'sleeping', label: isGuns ? '🟡 Ждёт выстрела (5+ глав)' : '🟡 В ожидании (спят)' },
      { value: 'forgotten', label: isGuns ? '🔴 Забытые ружья (10+ глав)' : '🔴 Забытые артефакты' },
      { value: 'destroyed', label: isGuns ? '⚪ Сорванные / Снятые' : '⚪ Выбывшие' },
    ];
  });

  function onScopeClick(scope: GunTrackerScope) {
    emit('set-scope', scope);
  }

  function onResetClick() {
    emit('reset-filter');
  }

  return {
    volumeWheelOptions,
    itemTypeWheelOptions,
    usageStateWheelOptions,
    onScopeClick,
    onResetClick,
  };
}


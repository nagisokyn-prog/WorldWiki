import type { ChekhovTrackerToolbarProps, ChekhovTrackerToolbarEmits } from './ChekhovTrackerToolbar.model';
import type { GunTrackerScope } from '../ChekhovGunTracker.model';

export function useChekhovTrackerToolbar(
  _props: ChekhovTrackerToolbarProps,
  emit: ChekhovTrackerToolbarEmits
) {
  function onScopeClick(scope: GunTrackerScope) {
    emit('set-scope', scope);
  }

  function onResetClick() {
    emit('reset-filter');
  }

  return {
    onScopeClick,
    onResetClick,
  };
}


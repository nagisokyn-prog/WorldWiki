import type { JourneyToolbarEmits } from './JourneyToolbar.model';
import type { JourneyFilterMode } from '../CharacterJourney.model';

export function useJourneyToolbar(emit: JourneyToolbarEmits) {
  const onFilterModeUpdate = (val: JourneyFilterMode) => {
    emit('update:filterMode', val);
    emit('update:filter-mode', val);
  };

  return {
    onFilterModeUpdate
  };
}


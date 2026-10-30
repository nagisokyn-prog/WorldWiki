import type { JourneyFilterMode } from '../CharacterJourney.model'

export interface JourneyModeToggleProps {
  modelValue: JourneyFilterMode;
}

export type JourneyModeToggleEmits = {
  (e: 'update:modelValue', val: JourneyFilterMode): void;
};

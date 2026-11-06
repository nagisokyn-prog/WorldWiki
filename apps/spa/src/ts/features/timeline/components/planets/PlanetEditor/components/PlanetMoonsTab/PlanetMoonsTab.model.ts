import type { PlanetDto } from '../../PlanetEditor.model'

export interface PlanetMoonsTabProps {
  planet: PlanetDto;
    isReadOnly?: boolean;
}

export type PlanetMoonsTabEmits = {
  (e: 'add-moon'): void;
    (e: 'remove-moon', idx: number): void;
};

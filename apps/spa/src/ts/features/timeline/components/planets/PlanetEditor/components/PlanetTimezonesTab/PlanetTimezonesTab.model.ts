import type { PlanetDto } from '../../PlanetEditor.model'

export interface PlanetTimezonesTabProps {
  planet: PlanetDto;
    isReadOnly?: boolean;
}

export type PlanetTimezonesTabEmits = {
  (e: 'apply-preset', preset: 'earth24' | 'single'): void;
  (e: 'apply-regions-preset', preset: 'earth' | 'fantasy'): void;
  (e: 'add-timezone'): void;
  (e: 'remove-timezone', idx: number): void;
  (e: 'add-region'): void;
  (e: 'remove-region', idx: number): void;
};

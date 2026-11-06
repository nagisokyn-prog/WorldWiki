import type { PlanetDto } from '../../PlanetEditor.model'

export interface PlanetAstrophysicsTabProps {
  planet: PlanetDto;
    decimalAxialTilt: number;
    isReadOnly?: boolean;
}

export type PlanetAstrophysicsTabEmits = {
  (e: 'update:day-hours', val: number): void;
    (e: 'update:day-minutes', val: number): void;
    (e: 'update:day-seconds', val: number): void;
    (e: 'update:orbit-days', val: number): void;
    (e: 'update:axial-tilt', val: number): void;
    (e: 'update:rotation-direction', val: 'direct' | 'retrograde'): void;
    (e: 'recalculate-astro-points'): void;
};

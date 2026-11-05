/**
 * @file PlanetPresetsModal.model.ts
 * @description Интерфейсы и типы данных для модального окна пресетов планет
 */
import type { PlanetPreset } from '@/features/timeline/components/planets/PlanetEditor/presets/planet.presets';

export interface PlanetPresetsModalProps {
  modelValue: boolean;
}

export interface PlanetPresetsModalEmits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'select-preset', preset: PlanetPreset): void;
}


/**
 * @file PlanetEditor.model.ts
 * @description Модель данных и типы для экрана настройки планеты (Planet View)
 */

export type PlanetEditorTab = 'astrophysics' | 'timezones' | 'moons';

export interface PlanetMoon {
  id?: string;
  name: string;
  orbital_period: number; // В сутках планеты (напр. 29.53)
  start_phase: number;    // От 0.0 до 1.0 (0.0 новолуние, 0.5 полнолуние)
  color?: string;
}

export interface PlanetTimezone {
  name: string;
  code: string;
  offset_hours: number;
  dst_rule: 'none' | 'eu' | 'us';
}

export interface PlanetRegion {
  name: string;
  timezone_code: string;
  latitude: number;
  longitude: number;
  max_day_hours?: string;
  min_day_hours?: string;
}

export interface PlanetSolstices {
  winter: number;
  spring: number;
  summer: number;
  autumn: number;
}

export interface PlanetDto {
  id?: string | null;
  name: string;
  icon?: string;
  ticks_per_day: number;
  day_hours: number;
  day_minutes: number;
  day_seconds: number;
  orbit_days_num: number;
  orbit_days_den: number;
  orbit_days: number;
  axial_tilt_mdeg: number; // Миллиградусы (23440 = 23.44°)
  rotation_direction: 'direct' | 'retrograde';
  solstices: PlanetSolstices;
  timezones: PlanetTimezone[];
  regions: PlanetRegion[];
  moons: PlanetMoon[];
}

export interface PlanetEditorProps {
  planetId: string;
  projectId: string;
  isReadOnly?: boolean;
}

export interface PlanetEditorEmits {
  (e: 'update:planet', planet: PlanetDto): void;
  (e: 'save', planet: PlanetDto): void;
  (e: 'delete', planetId: string): void;
}

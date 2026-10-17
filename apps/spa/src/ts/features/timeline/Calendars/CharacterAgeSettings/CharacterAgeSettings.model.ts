/**
 * @file CharacterAgeSettings.model.ts
 * @description Модели для настройки системы возраста персонажей в культуре.
 */

import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export interface CharacterAgeSettingsProps {
  modelValue: CalendarData;
}

export interface CharacterAgeSettingsEmits {
  (e: 'update:modelValue', val: CalendarData): void;
}

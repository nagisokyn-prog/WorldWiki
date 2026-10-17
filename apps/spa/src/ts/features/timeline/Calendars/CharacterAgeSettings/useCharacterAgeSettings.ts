/**
 * @file useCharacterAgeSettings.ts
 * @description Логика настроек исчисления возраста (западная, восточноазиатская, календарная).
 */

import { computed, ref } from 'vue';
import type { CharacterAgeSettingsProps, CharacterAgeSettingsEmits } from './CharacterAgeSettings.model';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';
import { useCalendarEngine } from '../../../../services/Calendars/useCalendarEngine';

export interface CharacterAgeRule {
  system: string;
  age_at_birth: number;
  step_on_new_year: boolean;
  year_only: boolean;
}

export function useCharacterAgeSettings(
  props: CharacterAgeSettingsProps,
  emit: CharacterAgeSettingsEmits
) {
  const isCollapsed = ref(false);
  const engine = useCalendarEngine();

  const ageRule = computed((): CharacterAgeRule => {
    const data = props.modelValue as CalendarData & { character_age_rule?: CharacterAgeRule };
    if (!data.character_age_rule) {
      data.character_age_rule = {
        system: 'western', // 'western' | 'east_asian' | 'year_only'
        age_at_birth: 0,
        step_on_new_year: false,
        year_only: false,
      };
    }
    return data.character_age_rule;
  });

  const selectedSystem = computed({
    get: () => ageRule.value.system || 'western',
    set: (sys: string) => {
      ageRule.value.system = sys;
      if (sys === 'east_asian') {
        ageRule.value.age_at_birth = 1;
        ageRule.value.step_on_new_year = true;
        ageRule.value.year_only = false;
      } else if (sys === 'year_only') {
        ageRule.value.age_at_birth = 0;
        ageRule.value.step_on_new_year = true;
        ageRule.value.year_only = true;
      } else {
        // western
        ageRule.value.age_at_birth = 0;
        ageRule.value.step_on_new_year = false;
        ageRule.value.year_only = false;
      }
      emit('update:modelValue', props.modelValue);
    },
  });

  const sampleAge = computed(() => {
    return engine.calculateAge({
      birth_year: 1000,
      birth_month: 5,
      birth_day: 15,
      current_year: 1020,
      current_month: 2,
      current_day: 1,
      age_at_birth: ageRule.value.age_at_birth,
      step_on_new_year: ageRule.value.step_on_new_year,
      year_only: ageRule.value.year_only,
      max_days_in_birth_month: 30,
    });
  });

  return {
    isCollapsed,
    selectedSystem,
    sampleAge,
  };
}

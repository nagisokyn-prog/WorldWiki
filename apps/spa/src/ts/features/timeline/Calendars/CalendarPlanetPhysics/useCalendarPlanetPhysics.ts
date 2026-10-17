/**
 * @file useCalendarPlanetPhysics.ts
 * @description Логика управления астрофизическими параметрами планеты (вращение, наклон, смещение суток).
 */

import { computed, ref } from 'vue';
import type { CalendarPlanetPhysicsProps, CalendarPlanetPhysicsEmits } from './CalendarPlanetPhysics.model';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export interface PlanetPhysicsConfig {
  planet_id: string;
  retrograde: boolean;
  axial_tilt_deg: number;
  day_start_mode: string;
}

export function useCalendarPlanetPhysics(
  props: CalendarPlanetPhysicsProps,
  emit: CalendarPlanetPhysicsEmits
) {
  const isCollapsed = ref(false);

  const physics = computed((): PlanetPhysicsConfig => {
    const data = props.modelValue as CalendarData & { planet_physics?: PlanetPhysicsConfig };
    if (!data.planet_physics) {
      data.planet_physics = {
        planet_id: 'earth',
        retrograde: false,
        axial_tilt_deg: 23.44,
        day_start_mode: 'midnight', // 'midnight' | 'sunrise' | 'sunset'
      };
    }
    return data.planet_physics;
  });

  const planetId = computed({
    get: () => physics.value.planet_id || 'earth',
    set: (val: string) => {
      physics.value.planet_id = val;
      emit('update:modelValue', props.modelValue);
    },
  });

  const retrograde = computed({
    get: () => physics.value.retrograde || false,
    set: (val: boolean) => {
      physics.value.retrograde = val;
      emit('update:modelValue', props.modelValue);
    },
  });

  const axialTilt = computed({
    get: () => physics.value.axial_tilt_deg ?? 23.44,
    set: (val: number) => {
      physics.value.axial_tilt_deg = val;
      emit('update:modelValue', props.modelValue);
    },
  });

  const dayStartMode = computed({
    get: () => physics.value.day_start_mode || 'midnight',
    set: (val: string) => {
      physics.value.day_start_mode = val;
      emit('update:modelValue', props.modelValue);
    },
  });

  return {
    isCollapsed,
    planetId,
    retrograde,
    axialTilt,
    dayStartMode,
  };
}

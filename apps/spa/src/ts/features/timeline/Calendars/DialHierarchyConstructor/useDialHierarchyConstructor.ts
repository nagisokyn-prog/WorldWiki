/**
 * @file useDialHierarchyConstructor.ts
 * @description Логика конструктора произвольных единиц циферблата (стражи, колокола, кэ) с квантованием.
 */

import { computed, ref } from 'vue';
import type { DialHierarchyConstructorProps, DialHierarchyConstructorEmits } from './DialHierarchyConstructor.model';
import type { DialUnit } from '@worldwiki/calendar-wasm';

export function useDialHierarchyConstructor(
  props: DialHierarchyConstructorProps,
  emit: DialHierarchyConstructorEmits
) {
  const isCollapsed = ref(false);

  const dialUnits = computed<DialUnit[]>({
    get: () => {
      const data = props.modelValue as any;
      if (!data.dial_hierarchy?.units) {
        data.dial_hierarchy = {
          units: [
            { name: 'Час', subdivisions: props.modelValue.настройки_времени?.часов_в_сутках || 24 },
            { name: 'Минута', subdivisions: props.modelValue.настройки_времени?.минут_в_часе || 60 },
          ],
        };
      }
      return data.dial_hierarchy.units;
    },
    set: (val: DialUnit[]) => {
      const data = props.modelValue as any;
      if (!data.dial_hierarchy) data.dial_hierarchy = {};
      data.dial_hierarchy.units = val;
      emit('update:modelValue', props.modelValue);
    },
  });

  const totalCapacity = computed(() => {
    return dialUnits.value.reduce((acc, u) => acc * Math.max(1, u.subdivisions), 1);
  });

  const ticksPerDay = computed(() => {
    const s = props.modelValue.настройки_времени;
    return (s?.часов_в_сутках || 24) * (s?.минут_в_часе || 60) * (s?.секунд_в_минуте || 60);
  });

  const isBijective = computed(() => {
    return ticksPerDay.value >= totalCapacity.value && ticksPerDay.value % totalCapacity.value === 0;
  });

  const quantumErrorSec = computed(() => {
    if (totalCapacity.value <= 0) return 0;
    return (ticksPerDay.value / totalCapacity.value).toFixed(2);
  });

  const addUnit = () => {
    dialUnits.value.push({
      name: `Единица ${dialUnits.value.length + 1}`,
      subdivisions: 10,
    });
    emit('update:modelValue', props.modelValue);
  };

  const removeUnit = (idx: number) => {
    dialUnits.value.splice(idx, 1);
    emit('update:modelValue', props.modelValue);
  };

  return {
    isCollapsed,
    dialUnits,
    totalCapacity,
    ticksPerDay,
    isBijective,
    quantumErrorSec,
    addUnit,
    removeUnit,
  };
}

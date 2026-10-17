import { computed, ref } from 'vue';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';
import type { CalendarMoonsProps } from './CalendarMoons.model';
import { useCalendarEngine } from '../../../../services/Calendars/useCalendarEngine';

export function useCalendarMoons(props: CalendarMoonsProps, emit: (event: 'update:modelValue', val: CalendarData) => void) {
  const isCollapsed = ref(false);
  const engine = useCalendarEngine();
  const doubleFullMoonResult = ref<string | null>(null);

  const calendar = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  });

  const addMoon = () => {
    if (!calendar.value.moons) calendar.value.moons = [];
    calendar.value.moons.push({
      name: `Луна ${calendar.value.moons.length + 1}`,
      period_days: 28,
      initial_phase: 0,
      phase_names: {
        new: 'Новолуние',
        waxing: 'Растущая',
        full: 'Полнолуние',
        waning: 'Убывающая'
      }
    } as any);
  };

  const moveItem = <T>(arr: T[] | undefined, idx: number, dir: number) => {
    if (!arr) return;
    if (idx + dir < 0 || idx + dir >= arr.length) return;
    const temp = arr[idx];
    arr[idx] = arr[idx + dir];
    arr[idx + dir] = temp;
  };

  const searchDoubleFullMoon = (idx1: number = 0, idx2: number = 1) => {
    const moons = calendar.value.moons || [];
    if (moons.length < 2) {
      doubleFullMoonResult.value = 'Требуется минимум две луны';
      return;
    }
    const m1 = moons[idx1];
    const m2 = moons[idx2];
    const ticksPerDay = (calendar.value.настройки_времени?.часов_в_сутках || 24) * 3600;

    const moonConfig1 = {
      name: m1.name,
      period_days_num: Math.round((m1.period_days || 28) * 1000),
      period_days_den: 1000,
      initial_phase_bp: Math.round(((m1.initial_phase || 0) * 10000) % 10000),
    };
    const moonConfig2 = {
      name: m2.name,
      period_days_num: Math.round((m2.period_days || 28) * 1000),
      period_days_den: 1000,
      initial_phase_bp: Math.round(((m2.initial_phase || 0) * 10000) % 10000),
    };

    const tFound = engine.findNextDoubleFullMoon(moonConfig1, moonConfig2, ticksPerDay, 0, 3650);
    if (tFound != null) {
      const day = Math.floor(tFound / ticksPerDay);
      doubleFullMoonResult.value = `Двойное полнолуние (${m1.name} и ${m2.name}) наступит на ${day}-й день!`;
    } else {
      doubleFullMoonResult.value = 'В ближайшие 10 лет одновременного полнолуния не найдено.';
    }
  };

  return {
    isCollapsed,
    calendar,
    addMoon,
    moveItem,
    doubleFullMoonResult,
    searchDoubleFullMoon,
  };
}

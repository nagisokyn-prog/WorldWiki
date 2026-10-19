import { computed } from 'vue';
import type { CalendarData, CalendarSeason, MoonConfig } from '@/services/Calendars/calendar.types';
import type {
  Tab2AstronomyProps,
  Tab2AstronomyEmits,
  CalendarMoon,
  CalendarPlanetPhysics,
} from './Tab2Astronomy.model';

export function useTab2Astronomy(
  props: Tab2AstronomyProps,
  emit: Tab2AstronomyEmits
) {
  const seasons = computed<CalendarSeason[]>(() => {
    return props.calendarData?.сезоны || [];
  });

  const moons = computed<CalendarMoon[]>(() => {
    const rawMoons = (props.calendarData?.moons || props.calendarData?.луны) as unknown as CalendarMoon[] | undefined;
    return rawMoons || [];
  });

  const physics = computed<CalendarPlanetPhysics>(() => {
    const raw = props.calendarData?.физика_планеты as CalendarPlanetPhysics | undefined;
    return (
      raw || {
        орбитальный_период: 365.2422,
        наклон_оси: 23.44,
      }
    );
  });

  function updateSeasons(newSeasons: CalendarSeason[]) {
    emit('update', { сезоны: newSeasons });
  }

  function updateMoons(newMoons: CalendarMoon[]) {
    emit('update', { moons: newMoons as unknown as MoonConfig[] });
  }

  function updatePhysics(patch: Partial<CalendarPlanetPhysics>) {
    emit('update', {
      физика_планеты: {
        ...physics.value,
        ...patch,
      },
    } as unknown as Partial<CalendarData>);
  }

  function addSeason() {
    const nextIdx = seasons.value.length + 1;
    const newSeason: CalendarSeason = {
      название: `Сезон ${nextIdx}`,
      месяцы: [],
      цвет: 'var(--accent-primary)',
    };
    updateSeasons([...seasons.value, newSeason]);
  }

  function removeSeason(idx: number) {
    updateSeasons(seasons.value.filter((_, i) => i !== idx));
  }

  return {
    seasons,
    moons,
    physics,
    updateSeasons,
    updateMoons,
    updatePhysics,
    addSeason,
    removeSeason,
  };
}

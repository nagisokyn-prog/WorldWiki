/**
 * @file usePlanetCalendarTree.ts
 * @description Composable логики группировки планет и календарей в дерево.
 */

import { ref, computed } from 'vue';
import type {
  PlanetCalendarTreeProps,
  PlanetCalendarTreeEmits,
  PlanetTreeGroup,
  CalendarTreeItem,
  PlanetEntity,
} from './PlanetCalendarTree.model';

export function usePlanetCalendarTree(
  props: PlanetCalendarTreeProps,
  emit: PlanetCalendarTreeEmits
) {
  const collapsedPlanets = ref<Set<string>>(new Set());

  const togglePlanet = (planetId: string) => {
    if (collapsedPlanets.value.has(planetId)) {
      collapsedPlanets.value.delete(planetId);
    } else {
      collapsedPlanets.value.add(planetId);
    }
  };

  const treeGroups = computed<PlanetTreeGroup[]>(() => {
    const list = props.planets || [];
    const allCals = props.calendars || [];

    return list.map((planet) => {
      const planetCals: CalendarTreeItem[] = [];

      allCals.forEach((cal, originalIdx) => {
        const rawPlanetId = (cal.planet_id as string | undefined) ?? cal.data?.planet_id;
        const calPlanetId = typeof rawPlanetId === 'string' && rawPlanetId.trim() !== '' ? rawPlanetId : planet.id;
        const cleanCalPlanet = calPlanetId.replace(/^(entity:)?planets?:/, '');
        const cleanPlanet = String(planet.id || '').replace(/^(entity:)?planets?:/, '');
        const matchesPlanet = cleanCalPlanet === cleanPlanet || (!rawPlanetId && (cleanPlanet.endsWith('earth') || planet.name === 'Земля'));
        if (matchesPlanet) {
          const isMaster = Boolean(cal.is_master || cal.data?.is_master || cal.data?.calendar_type === 'master' || cal.data?.название === 'Календарь Мира');
          const rawName = typeof cal.name === 'string' && cal.name ? cal.name : '';
          const calName = cal.data?.название || rawName || (isMaster ? 'Календарь Мира' : 'Календарь');
          planetCals.push({
            id: cal.id,
            idx: originalIdx,
            name: calName,
            is_master: isMaster,
            planet_id: calPlanetId,
            data: cal.data,
          });
        }
      });

      return {
        planet,
        calendars: planetCals,
        isExpanded: !collapsedPlanets.value.has(planet.id),
      };
    });
  });

  const selectPlanet = (planet: PlanetEntity) => {
    emit('select-planet', planet);
  };

  const selectCalendar = (calIdx: number) => {
    emit('select-calendar', calIdx);
  };

  const addCalendar = (planetId: string) => {
    emit('add-calendar', planetId);
  };

  const addPlanet = () => {
    emit('add-planet');
  };

  return {
    treeGroups,
    togglePlanet,
    selectPlanet,
    selectCalendar,
    addCalendar,
    addPlanet,
  };
}

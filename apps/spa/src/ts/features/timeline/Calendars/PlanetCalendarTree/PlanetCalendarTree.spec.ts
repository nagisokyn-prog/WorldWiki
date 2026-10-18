import { describe, it, expect, vi } from 'vitest';
import { usePlanetCalendarTree } from './usePlanetCalendarTree';
import type { PlanetEntity, CalendarData } from '../../../../services/Calendars/calendar.types';

describe('usePlanetCalendarTree', () => {
  const planets: PlanetEntity[] = [
    { id: 'earth', project_id: 'test', name: 'Земля', ticks_per_day: 86400, orbit_days: 365.2422 },
    { id: 'mars', project_id: 'test', name: 'Марс', ticks_per_day: 88775, orbit_days: 668.59 },
  ];

  const calendars = [
    {
      id: 'cal1',
      is_master: false,
      data: { planet_id: 'earth', название: 'РФ' } as CalendarData,
    },
    {
      id: 'cal2',
      is_master: false,
      data: { planet_id: 'mars', название: 'Дариский' } as CalendarData,
    },
  ];

  it('correctly groups calendars under their parent planets', () => {
    const emit = vi.fn();
    const { treeGroups } = usePlanetCalendarTree({ planets, calendars }, emit);

    expect(treeGroups.value.length).toBe(2);
    expect(treeGroups.value[0].planet.name).toBe('Земля');
    expect(treeGroups.value[0].calendars.length).toBe(1);
    expect(treeGroups.value[0].calendars[0].name).toBe('РФ');

    expect(treeGroups.value[1].planet.name).toBe('Марс');
    expect(treeGroups.value[1].calendars.length).toBe(1);
    expect(treeGroups.value[1].calendars[0].name).toBe('Дариский');
  });

  it('emits selection and creation events', () => {
    const emit = vi.fn();
    const { selectPlanet, selectCalendar, addCalendar, addPlanet } = usePlanetCalendarTree(
      { planets, calendars },
      emit
    );

    selectPlanet(planets[0]);
    expect(emit).toHaveBeenCalledWith('select-planet', planets[0]);

    selectCalendar(0);
    expect(emit).toHaveBeenCalledWith('select-calendar', 0);

    addCalendar('mars');
    expect(emit).toHaveBeenCalledWith('add-calendar', 'mars');

    addPlanet();
    expect(emit).toHaveBeenCalledWith('add-planet');
  });
});

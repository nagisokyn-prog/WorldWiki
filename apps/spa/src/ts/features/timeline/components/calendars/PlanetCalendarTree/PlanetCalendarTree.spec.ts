import { describe, it, expect, vi } from 'vitest';
import { usePlanetCalendarTree } from './usePlanetCalendarTree';
import type { PlanetEntity, CalendarData } from '@/services/Calendars/calendar.types';

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

  it('toggles planet collapse/expand and handles fallback names, master flags, and empty props', () => {
    const emit = vi.fn();
    const { treeGroups, togglePlanet } = usePlanetCalendarTree(
      {
        planets: [
          { id: 'entity:planet:earth', project_id: 'p1', name: 'Земля', ticks_per_day: 86400, orbit_days: 365 },
        ],
        calendars: [
          { id: 'c_master', is_master: false, data: { название: 'Календарь Мира' } as CalendarData },
          { id: 'c_named', name: 'ИмяИзЗаписи', is_master: false, data: { planet_id: 'earth' } as CalendarData },
          { id: 'c_default', is_master: false, data: { planet_id: 'earth' } as CalendarData },
        ],
      },
      emit
    );

    expect(treeGroups.value[0].isExpanded).toBe(true);
    togglePlanet('entity:planet:earth');
    expect(treeGroups.value[0].isExpanded).toBe(false);
    togglePlanet('entity:planet:earth');
    expect(treeGroups.value[0].isExpanded).toBe(true);

    expect(treeGroups.value[0].calendars.map((c) => c.name)).toEqual([
      'Календарь Мира',
      'ИмяИзЗаписи',
      'Календарь',
    ]);
    expect(treeGroups.value[0].calendars[0].is_master).toBe(true);

    const empty = usePlanetCalendarTree({ planets: undefined as any, calendars: undefined as any }, emit);
    expect(empty.treeGroups.value).toEqual([]);
  });
});

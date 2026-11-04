import { describe, it, expect } from 'vitest';
import {
  cleanEntityId,
  parseTimezoneOffset,
  resolveLocationGeography,
  computeLocationLocalTime,
} from '../locationHierarchy';
import { CalendarEngine } from '../../Calendars/useCalendarEngine';
import type { WorldTimezone } from '../../Calendars/calendar.types';

describe('locationHierarchy service', () => {
  const mockTimezones: WorldTimezone[] = [
    { id: 'tz_utc', name: 'Гринвич', code: 'UTC', base_offset_hours: 0 },
    { id: 'tz_east', name: 'Восточный предел', code: 'EAST+5', base_offset_hours: 5 },
    { id: 'tz_west', name: 'Западный океан', code: 'WEST-8', base_offset_hours: -8 },
  ];

  it('cleans entity IDs across SurrealDB formats', () => {
    expect(cleanEntityId('entities:loc_1')).toBe('loc_1');
    expect(cleanEntityId('locations:⟨city_north⟩')).toBe('city_north');
    expect(cleanEntityId({ id: 'entities:room_42' })).toBe('room_42');
    expect(cleanEntityId(null)).toBe('');
  });

  it('parses timezone offsets from IDs, strings, and solar longitude', () => {
    expect(parseTimezoneOffset('tz_east', mockTimezones).offsetHours).toBe(5);
    expect(parseTimezoneOffset('WEST-8', mockTimezones).offsetHours).toBe(-8);
    expect(parseTimezoneOffset('UTC+4', mockTimezones).offsetHours).toBe(4);
    expect(parseTimezoneOffset('-03:30', mockTimezones).offsetHours).toBe(-3.5);
    // Fallback to solar longitude when timezone string is empty (60 deg East -> +4h)
    expect(parseTimezoneOffset('', mockTimezones, 0, 60).offsetHours).toBe(4);
  });

  it('inherits coordinates, timezone, and state upward through 4 hierarchy levels (Room -> Building -> District -> City)', () => {
    const city = {
      id: 'entities:city_nord',
      entity_type: 'location',
      name: 'Нордхейвен',
      attributes: {
        scale_level: 'settlement',
        широта: 60,
        долгота: 45,
        часовой_пояс: '+3',
        климатический_пояс: 'subarctic',
        принадлежность_государству: 'entities:state_north',
      },
    };

    const district = {
      id: 'entities:dist_docks',
      entity_type: 'location',
      name: 'Район Доков',
      attributes: {
        scale_level: 'district',
        родительская_локация: 'entities:city_nord',
      },
    };

    const hospital = {
      id: 'entities:bld_hospital',
      entity_type: 'location',
      name: 'Госпиталь Святого Ансельма',
      attributes: {
        scale_level: 'building',
        тип_заведения: 'medical',
        родительская_локация: 'entities:dist_docks',
      },
    };

    const ward = {
      id: 'entities:room_ward_4',
      entity_type: 'location',
      name: 'Палата №4',
      attributes: {
        scale_level: 'interior',
        родительская_локация: 'entities:bld_hospital',
      },
    };

    const stateNorth = {
      id: 'entities:state_north',
      entity_type: 'state',
      name: 'Северный Доминион',
      attributes: {
        столица: 'entities:city_nord',
        официальный_календарь: 'cal_north',
      },
    };

    const all = [city, district, hospital, ward, stateNorth];
    const resolved = resolveLocationGeography(ward, all, mockTimezones);

    expect(resolved.scale).toBe('interior');
    expect(resolved.latitude).toBe(60);
    expect(resolved.longitude).toBe(45);
    expect(resolved.offsetHours).toBe(3);
    expect(resolved.isInherited).toBe(true);
    expect(resolved.inheritedFromId).toBe('city_nord');
    expect(resolved.inheritedFromName).toBe('Нордхейвен');
    expect(resolved.climateZone).toBe('subarctic');
    expect(resolved.stateName).toBe('Северный Доминион');
    expect(resolved.officialCalendarId).toBe('cal_north');
    expect(resolved.breadcrumbs.map((b) => b.name)).toEqual([
      'Нордхейвен',
      'Район Доков',
      'Госпиталь Святого Ансельма',
      'Палата №4',
    ]);
  });

  it('guards against circular parent references without infinite loops', () => {
    const locA = {
      id: 'entities:loc_a',
      name: 'Петля А',
      родительская_локация: 'entities:loc_b',
    };
    const locB = {
      id: 'entities:loc_b',
      name: 'Петля Б',
      родительская_локация: 'entities:loc_a',
      широта: 25,
    };

    const resolved = resolveLocationGeography(locA, [locA, locB], mockTimezones);
    expect(resolved.latitude).toBe(25);
    expect(resolved.breadcrumbs.length).toBe(2);
  });

  it('inherits timezone and capital coordinates from State when location has only state reference', () => {
    const capitalCity = {
      id: 'entities:cap_solaris',
      entity_type: 'location',
      name: 'Солярис-Прайм',
      scale_level: 'settlement',
      широта: 15,
      долгота: 75,
    };
    const empire = {
      id: 'entities:state_empire',
      entity_type: 'state',
      name: 'Солнечная Империя',
      столица: 'entities:cap_solaris',
      официальный_часовой_пояс: 'UTC+5',
    };
    const village = {
      id: 'entities:loc_village',
      entity_type: 'location',
      name: 'Тихая Заводь',
      scale_level: 'settlement',
      принадлежность_государству: 'entities:state_empire',
    };

    const resolved = resolveLocationGeography(
      village,
      [capitalCity, empire, village],
      mockTimezones
    );

    expect(resolved.offsetHours).toBe(5);
    expect(resolved.latitude).toBe(15);
    expect(resolved.longitude).toBe(75);
    expect(resolved.isInherited).toBe(true);
    expect(resolved.stateName).toBe('Солнечная Империя');

    const capResolved = resolveLocationGeography(
      capitalCity,
      [capitalCity, empire, village],
      mockTimezones
    );
    expect(capResolved.isStateCapital).toBe(true);
    expect(capResolved.stateName).toBe('Солнечная Империя');
  });

  it('computes local time and detects discrepancy between world day and local night', () => {
    const cal = CalendarEngine.getDefaultCalendar();
    const westCity = {
      id: 'entities:city_west',
      name: 'Порт Заката',
      широта: 30,
      долгота: -150,
      часовой_пояс: '-10',
    };
    const geo = resolveLocationGeography(westCity, [westCity], mockTimezones);

    // 12:00 (полдень) на нулевом меридиане -> 720-я минута первых суток
    const result = computeLocationLocalTime(720, geo, cal, mockTimezones);
    expect(result.worldTimeStr).toBe('12:00');
    expect(result.localTimeStr).toBe('02:00');
    expect(result.sunStatus.phase).toBe('night');
    expect(result.hasDiscrepancy).toBe(true);
    expect(result.discrepancyHint).toContain('Порт Заката');
  });
});


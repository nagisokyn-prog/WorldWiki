import { describe, it, expect } from 'vitest';
import { getSunPhaseEmoji, computeLocationLocalTime } from './locationTime';
import { CalendarMath } from '../Calendars/useCalendarEngine';
import type { ResolvedLocationGeography } from './locationHierarchy.types';

describe('locationTime', () => {
  const baseGeo: ResolvedLocationGeography = {
    entityId: 'loc_1',
    entityName: 'Столица',
    offsetHours: 3,
    timezoneId: 'tz_3',
    scale: 'settlement',
    isStateCapital: true,
    hasExplicitGeography: true,
    isInherited: false,
  };

  it('returns correct sun phase emojis', () => {
    expect(getSunPhaseEmoji('dawn')).toBe('🌅');
    expect(getSunPhaseEmoji('day')).toBe('☀️');
    expect(getSunPhaseEmoji('dusk')).toBe('🌇');
    expect(getSunPhaseEmoji('night')).toBe('🌙');
  });

  it('computes fallback local time without masterCalendar across dawn/day/dusk/night', () => {
    // 03:00 world + 3h offset = 06:00 -> dawn
    const dawn = computeLocationLocalTime(3 * 60, baseGeo, null);
    expect(dawn.phaseEmoji).toBe('🌅');
    expect(dawn.hasDiscrepancy).toBe(true);

    // 09:00 world + 3h = 12:00 -> day
    const day = computeLocationLocalTime(9 * 60, baseGeo, null);
    expect(day.phaseEmoji).toBe('☀️');

    // 17:00 world + 3h = 20:00 -> dusk
    const dusk = computeLocationLocalTime(17 * 60, baseGeo, null);
    expect(dusk.phaseEmoji).toBe('🌇');

    // 22:00 world + 3h = 01:00 -> night
    const night = computeLocationLocalTime(22 * 60, baseGeo, null);
    expect(night.phaseEmoji).toBe('🌙');

    // isLocalTime = true ignores offset discrepancy
    const localOnly = computeLocationLocalTime(22 * 60, baseGeo, null, [], true);
    expect(localOnly.hasDiscrepancy).toBe(false);
  });

  it('computes local time with masterCalendar for world and local modes', () => {
    const master = CalendarMath.getDefaultCalendar();
    const worldMode = computeLocationLocalTime(12 * 60, baseGeo, master, [], false);
    expect(worldMode.hasDiscrepancy).toBe(true);
    expect(worldMode.discrepancyHint).toContain('Столица');

    const localMode = computeLocationLocalTime(12 * 60, { ...baseGeo, offsetHours: -2 }, master, [], true);
    expect(localMode.hasDiscrepancy).toBe(false);
    expect(localMode.localTimeStr).toBe('12:00');
  });
});

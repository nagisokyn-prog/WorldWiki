import { describe, it, expect } from 'vitest';
import { getDefaultPlanet, normalizeCalendarId } from '../calendarStore.utils';

describe('calendarStore.utils', () => {
  describe('getDefaultPlanet', () => {
    it('generates a unique random planet id if no id provided', () => {
      const p1 = getDefaultPlanet('Проект 1');
      const p2 = getDefaultPlanet('Проект 2');
      expect(p1.id).toBeDefined();
      expect(p2.id).toBeDefined();
      expect(p1.id).not.toBe(p2.id);
      expect(p1.id).toMatch(/^planet_/);
      expect(p1.project_id).toBe('Проект 1');
      expect(p2.project_id).toBe('Проект 2');
    });

    it('uses provided custom id if given', () => {
      const planet = getDefaultPlanet('Не один', 'planet_custom_id');
      expect(planet.id).toBe('planet_custom_id');
      expect(planet.project_id).toBe('Не один');
      expect(planet.name).toBe('Земля');
    });
  });

  describe('normalizeCalendarId', () => {
    it('normalizes string id with quotes and brackets', () => {
      expect(normalizeCalendarId('calendars:⟨cal_1⟩')).toBe('calendars:cal_1');
      expect(normalizeCalendarId(' "cal_2" ')).toBe('cal_2');
    });

    it('normalizes object id with tb and id', () => {
      expect(normalizeCalendarId({ tb: 'calendars', id: '123' })).toBe('calendars:123');
      expect(normalizeCalendarId({ tb: 'planets', id: { String: 'pl_1' } })).toBe('planets:pl_1');
    });

    it('returns empty string on empty input', () => {
      expect(normalizeCalendarId('')).toBe('');
      expect(normalizeCalendarId(null)).toBe('');
      expect(normalizeCalendarId(undefined)).toBe('');
    });
  });
});


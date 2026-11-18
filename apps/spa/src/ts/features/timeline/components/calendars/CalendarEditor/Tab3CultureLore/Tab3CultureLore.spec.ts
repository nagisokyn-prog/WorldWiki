/**
 * @file Tab3CultureLore.spec.ts
 * @description Unit-тесты для useTab3CultureLore (Сезоны, праздники, фазы луны, возраст, регионы)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTab3CultureLore } from './useTab3CultureLore';
import type { Tab3CultureLoreEmits } from './Tab3CultureLore.model';
import type { CalendarData } from '@/services/Calendars/calendar.types';

describe('useTab3CultureLore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockCalendar: CalendarData = {
    название: 'Лор Календарь',
    дней_в_неделе: 7,
    названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    первый_месяц_года: 0,
    месяцы: [{ название: 'Январь', дней: 31 }],
    эпохи: [{ название: 'Новая Эра', год_начала: 1, год_конца: 9999 }],
    сезоны: [{ название: 'Лето', цвет: '#f59e0b', hemisphere: 'northern', месяцы: [0] }],
    праздники: [{ название: 'Солнцеворот', дата_начала: { месяц: 5, день: 21 }, is_range: false }],
  };

  it('добавляет и удаляет сезоны', () => {
    const emit = vi.fn() as unknown as Tab3CultureLoreEmits;
    const { addSeason, removeSeason } = useTab3CultureLore({ calendarData: mockCalendar }, emit);

    addSeason();
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      сезоны: expect.arrayContaining([expect.objectContaining({ название: 'Сезон 2' })]),
    }));

    removeSeason(0);
    expect(emit).toHaveBeenCalled();
  });

  it('добавляет и удаляет праздники', () => {
    const emit = vi.fn() as unknown as Tab3CultureLoreEmits;
    const { addHoliday, removeHoliday } = useTab3CultureLore({ calendarData: mockCalendar }, emit);

    addHoliday();
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      праздники: expect.arrayContaining([expect.objectContaining({ название: 'Новый праздник' })]),
    }));

    removeHoliday(0);
    expect(emit).toHaveBeenCalled();
  });

  it('обновляет правило возраста персонажей', () => {
    const emit = vi.fn() as unknown as Tab3CultureLoreEmits;
    const { updateAgeRule } = useTab3CultureLore({ calendarData: mockCalendar }, emit);

    updateAgeRule({ age_at_birth: 1, step_on_new_year: true, year_only: true });
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      character_age_rules: expect.objectContaining({ age_at_birth: 1, step_on_new_year: true, year_only: true }),
    }));
  });

  it('управляет регионами распространения', () => {
    const emit = vi.fn() as unknown as Tab3CultureLoreEmits;
    const { toggleRegion, addRegion } = useTab3CultureLore({ calendarData: mockCalendar }, emit);

    toggleRegion('desert');
    expect(emit).toHaveBeenCalledWith('update', expect.objectContaining({
      culture_regions: expect.arrayContaining(['desert']),
    }));

    addRegion('Новая Провинция');
    expect(emit).toHaveBeenCalled();
  });

  it('covers planet-linked regions/timezones, defaults, moon phase names, and calendarTimezone', async () => {
    const { useCalendarStore } = await import('@/stores/calendar.store');
    const calStore = useCalendarStore();
    vi.spyOn(calStore, 'getPlanets').mockReturnValue([
      {
        id: 'planets:p1',
        name: 'Терра',
        project_id: 'proj-1',
        ticks_per_day: 86400,
        orbit_days: 365,
        axial_tilt: 23.4,
        is_retrograde: false,
        regions: [{ id: 'r1', name: 'Север', timezone_id: 'UTC+1', latitude: 60, longitude: 10 }],
        timezones: [{ id: 'tz1', name: 'Центр', code: 'UTC+1', base_offset_hours: 1 }],
        moons: []
      }
    ]);
    vi.spyOn(calStore, 'savePlanet').mockResolvedValue(undefined);

    const emit = vi.fn() as unknown as Tab3CultureLoreEmits;
    const cal12 = {
      ...mockCalendar,
      project_id: 'proj-1',
      planet_id: 'planets:p1',
      сезоны: [],
      праздники: [],
      месяцы: Array.from({ length: 12 }, (_, i) => ({ название: `M${i + 1}`, дней: 30 })),
      moons: [{ name: 'Селена', period_days: 29.5, phase_names: { new: 'Н', waxing: 'Р', full: 'П', waning: 'У' } }]
    } as unknown as CalendarData;

    const lore = useTab3CultureLore({ calendarData: cal12, projectId: 'proj-1', planetId: 'planets:p1' }, emit);

    expect(lore.seasons.value).toHaveLength(4);
    expect(lore.holidays.value).toHaveLength(2);
    expect(lore.phaseNames.value.new).toBe('Н');
    expect(lore.regionsList.value[0].id).toBe('r1');
    expect(lore.timezonesList.value[0].value).toBe('UTC+1');
    expect(lore.calendarTimezone.value).toBe('UTC+1');
    expect(lore.findDoubleFullMoon()).toBeNull();

    lore.updatePhaseNames({ new: 'N', waxing: 'W', full: 'F', waning: 'D' });
    lore.setCalendarTimezone('UTC+5');
    expect(emit).toHaveBeenCalledWith('update', { calendar_timezone: 'UTC+5' });

    await lore.addRegion('Юг');
    expect(calStore.savePlanet).toHaveBeenCalled();

    // Toggle existing region off
    lore.toggleRegion('r1');
  });
});

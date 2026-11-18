import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTab3CultureLore } from './useTab3CultureLore';
import { useCalendarStore } from '@/stores/calendar.store';

describe('useTab3CultureLore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('computes default 12-month seasons, holidays, ageRule, planet regions/timezones, and emits updates', async () => {
    const calStore = useCalendarStore();
    vi.spyOn(calStore, 'getPlanets').mockReturnValue([
      {
        id: 'planets:p1',
        name: 'Терра',
        regions: [{ name: 'Север' }, { id: 'reg_2', code: 'S', name: '' }],
        timezones: [{ name: 'UTC+0', code: 'UTC+0', base_offset_hours: 0 }, { name: 'Запад', base_offset_hours: -3 }],
      } as any,
    ]);
    const savePlanetSpy = vi.spyOn(calStore, 'savePlanetToStorage').mockImplementation(() => {});

    const emit = vi.fn();
    const hook = useTab3CultureLore(
      {
        projectId: 'p1',
        calendarData: {
          название: 'Календарь',
          planet_id: 'planets:p1',
          месяцы: Array.from({ length: 12 }, (_, i) => ({ название: `М${i + 1}`, дней: 30 })),
          character_age_rules: { age_at_birth: 1, step_on_new_year: true, year_only: false },
          moons: [{ name: 'Селена', period_days: 28, phase_names: { new: 'Н', waxing: 'Р', full: 'П', waning: 'У' } }],
        } as any,
      } as any,
      emit
    );

    expect(hook.seasons.value).toHaveLength(4);
    expect(hook.holidays.value.length).toBeGreaterThanOrEqual(2);
    expect(hook.ageRule.value.age_at_birth).toBe(1);
    expect(hook.regionsList.value).toHaveLength(2);
    expect(hook.timezonesList.value).toHaveLength(2);

    hook.addRegion('Новый регион', 'UTC+0');
    expect(hook.regionsList.value.length).toBeGreaterThanOrEqual(2);

    // Update moon phase names
    hook.updatePhaseNames({ new: 'Тьма', waxing: 'Р', full: 'П', waning: 'У' });
    expect(emit).toHaveBeenCalled();
  });

  it('handles empty months, empty planets, and fallback timezone', () => {
    const calStore = useCalendarStore();
    vi.spyOn(calStore, 'getPlanets').mockReturnValue([]);

    const hook = useTab3CultureLore(
      {
        projectId: 'p1',
        calendarData: {
          название: 'Пустой',
          месяцы: [],
          сезоны: [{ название: 'Вечное лето', месяцы: [0] }],
          праздники: [{ название: 'День', дата_начала: { месяц: 0, день: 1 }, is_range: false }],
        } as any,
      } as any,
      vi.fn()
    );

    expect(hook.seasons.value).toHaveLength(1);
    expect(hook.holidays.value).toHaveLength(1);
    expect(hook.regionsList.value).toHaveLength(3);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { syncPresetWithPlanet } from './useCalendarPresetSync';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type { CalendarPreset } from '@/features/timeline/components/calendars/presets';
import type { useCalendarStore } from '@/stores/calendar.store';

describe('useCalendarPresetSync', () => {
  const preset = {
    id: 'europe',
    name: 'Европа',
  } as unknown as CalendarPreset;

  const makeStore = (planets: Array<Record<string, unknown>>, savePlanet = vi.fn().mockResolvedValue(undefined)) =>
    ({
      getPlanets: vi.fn().mockReturnValue(planets),
      savePlanet,
    }) as unknown as ReturnType<typeof useCalendarStore>;

  it('returns early when no planets exist', async () => {
    const store = makeStore([]);
    const data = { название: 'Test' } as unknown as CalendarData;

    await syncPresetWithPlanet(preset, data, 'proj-1', store);
    expect(store.savePlanet).not.toHaveBeenCalled();
  });

  it('adds timezone and region to matched planet and saves', async () => {
    const savePlanet = vi.fn().mockResolvedValue(undefined);
    const store = makeStore([
      { id: 'planets:p1', name: 'Earth', timezones: [], regions: [] },
    ], savePlanet);
    const data = {
      название: 'Gregorian',
      planet_id: 'p1',
      calendar_timezone: 'UTC+3',
    } as unknown as CalendarData;

    await syncPresetWithPlanet(preset, data, 'proj-1', store);

    expect(data.region_ids).toContain('reg_europe');
    expect(savePlanet).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        timezones: [
          expect.objectContaining({ code: 'UTC+3', base_offset_hours: 3 }),
        ],
        regions: [
          expect.objectContaining({ id: 'reg_europe', name: 'Европа', timezone_id: 'UTC+3' }),
        ],
      })
    );
  });

  it('reuses existing timezone and region without saving planet again', async () => {
    const savePlanet = vi.fn().mockResolvedValue(undefined);
    const store = makeStore([
      {
        id: 'planets:p1',
        name: 'Earth',
        timezones: [{ id: 'tz1', name: 'UTC+3', code: 'UTC+3', base_offset_hours: 3 }],
        regions: [{ id: 'existing_reg', name: 'Европа (Запад)', timezone_id: 'UTC+3' }],
      },
    ], savePlanet);
    const data = {
      название: 'Gregorian',
      planet_id: 'Earth',
      calendar_timezone: 'UTC+3',
      region_ids: ['existing_reg'],
    } as unknown as CalendarData;

    await syncPresetWithPlanet(preset, data, 'proj-1', store);
    expect(savePlanet).not.toHaveBeenCalled();
  });

  it('handles errors gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = {
      getPlanets: vi.fn(() => {
        throw new Error('store fail');
      }),
    } as unknown as ReturnType<typeof useCalendarStore>;

    await syncPresetWithPlanet(preset, {} as CalendarData, 'proj-1', store);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarSeasons } from '../useCalendarSeasons';

describe('useCalendarSeasons', () => {
  let props: any;

  beforeEach(() => {
    props = {
      modelValue: {
        месяцы: [{ название: 'М1' }, { название: 'М2' }, { название: 'М3' }, { название: 'М4' }],
        сезоны: [
          { название: 'Весна', месяцы: [0, 1] },
          { название: 'Лето', месяцы: [2] },
        ],
      },
    };
  });

  it('handles addSeason and removeSeason with empty/undefined modelValue', () => {
    const emptyProps: any = { modelValue: {} };
    const hook = useCalendarSeasons(emptyProps);

    expect(hook.isMonthInSeason(0, 1)).toBe(false);

    // Remove on undefined
    hook.removeSeason(0);

    // moveItem on undefined seasons (covers line 13 if (!arr) return)
    hook.moveItem(0, 1);

    // Add on undefined seasons and months
    hook.addSeason();
    expect(emptyProps.modelValue.сезоны.length).toBe(1);
    expect(emptyProps.modelValue.сезоны[0].месяцы).toEqual([]);
  });

  it('adds and removes seasons on populated modelValue', () => {
    const hook = useCalendarSeasons(props);

    // Month 3 is unused (Весна has 0,1, Лето has 2)
    hook.addSeason();
    expect(props.modelValue.сезоны.length).toBe(3);
    expect(props.modelValue.сезоны[2].название).toBe('Сезон 3');
    expect(props.modelValue.сезоны[2].месяцы).toEqual([3]);
    expect(props.modelValue.сезоны[2].цвет).toBe('#3b82f6');

    hook.removeSeason(1);
    expect(props.modelValue.сезоны.length).toBe(2);
    expect(props.modelValue.сезоны[1].название).toBe('Сезон 3');
  });

  it('moves items within bounds and ignores out of bounds moves', () => {
    const hook = useCalendarSeasons(props);

    // Out of bounds up
    hook.moveItem(0, -1);
    expect(props.modelValue.сезоны[0].название).toBe('Весна');

    // Valid move down
    hook.moveItem(0, 1);
    expect(props.modelValue.сезоны[0].название).toBe('Лето');
    expect(props.modelValue.сезоны[1].название).toBe('Весна');

    // Out of bounds down
    hook.moveItem(1, 1);
    expect(props.modelValue.сезоны[1].название).toBe('Весна');
  });

  it('toggles months in season, removing from other seasons if present', () => {
    const hook = useCalendarSeasons(props);

    // Toggle non-existent season index
    hook.toggleMonthInSeason(99, 0);

    // Add month 2 (currently in Лето sIdx=1) into Весна (sIdx=0)
    hook.toggleMonthInSeason(0, 2);
    expect(props.modelValue.сезоны[0].месяцы).toEqual([0, 1, 2]);
    expect(props.modelValue.сезоны[1].месяцы).toEqual([]);

    // Remove month 2 from Весна
    hook.toggleMonthInSeason(0, 2);
    expect(props.modelValue.сезоны[0].месяцы).toEqual([0, 1]);

    // Test season with undefined месяцы
    props.modelValue.сезоны.push({ название: 'Осень' });
    hook.toggleMonthInSeason(2, 3);
    expect(props.modelValue.сезоны[2].месяцы).toEqual([3]);
  });

  it('formats color correctly with fallback value and toggles hemisphere', () => {
    const hook = useCalendarSeasons(props);
    expect(hook.formatColor('var(--color-info)')).toBe('var(--color-info)');
    expect(hook.formatColor(undefined)).toBe('var(--text-info)');

    const season: any = { название: 'Лето', месяцы: [2] };
    expect(season.hemisphere).toBeUndefined();

    hook.toggleHemisphere(season);
    expect(season.hemisphere).toBe('southern');

    hook.toggleHemisphere(season);
    expect(season.hemisphere).toBe('northern');
  });
});

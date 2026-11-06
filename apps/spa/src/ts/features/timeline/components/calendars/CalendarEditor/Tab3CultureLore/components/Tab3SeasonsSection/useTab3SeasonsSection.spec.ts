import { describe, it, expect, vi } from 'vitest';
import { useTab3SeasonsSection } from './useTab3SeasonsSection';
import type { Tab3SeasonsSectionProps } from './Tab3SeasonsSection.model';

describe('useTab3SeasonsSection', () => {
  const props: Tab3SeasonsSectionProps = {
    seasons: [
      { id: 's1', название: 'Лето', цвет: '--color-accent', hemisphere: 'northern', месяцы: [0, 1] },
    ],
    months: [],
  };

  it('toggles hemisphere and emits update', () => {
    const emit = vi.fn();
    const { toggleHemisphere } = useTab3SeasonsSection(props, emit as any);

    toggleHemisphere(props.seasons[0]);
    expect(props.seasons[0].hemisphere).toBe('southern');
    expect(emit).toHaveBeenCalledWith('update-seasons', expect.any(Array));
  });

  it('toggles month in season', () => {
    const emit = vi.fn();
    const { toggleMonthInSeason } = useTab3SeasonsSection(props, emit as any);

    toggleMonthInSeason(props.seasons[0], 2);
    expect(props.seasons[0].месяцы).toEqual([0, 1, 2]);

    toggleMonthInSeason(props.seasons[0], 0);
    expect(props.seasons[0].месяцы).toEqual([1, 2]);
  });

  it('sets season color and emits update', () => {
    const emit = vi.fn();
    const { setSeasonColor } = useTab3SeasonsSection(props, emit as any);

    setSeasonColor(props.seasons[0], '--color-warning');
    expect(props.seasons[0].цвет).toBe('--color-warning');
    expect(emit).toHaveBeenCalledWith('update-seasons', expect.any(Array));
  });
});


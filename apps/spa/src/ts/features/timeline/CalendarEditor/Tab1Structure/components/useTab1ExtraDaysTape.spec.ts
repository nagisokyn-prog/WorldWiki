import { describe, it, expect } from 'vitest';
import { useTab1ExtraDaysTape } from './useTab1ExtraDaysTape';
import type { Tab1ExtraDaysTapeProps } from './Tab1ExtraDaysTape.model';

describe('useTab1ExtraDaysTape Composable', () => {
  const defaultProps: Tab1ExtraDaysTapeProps = {
    extraDaysCount: 5,
    extraDaysName: 'Эпагомены',
    placement: 'end_of_year',
    afterMonthIndex: 0,
    pauseWeekdays: true,
    months: [
      { id: 'm1', название: 'Январь', дней: 30, сезон: 'Зима' },
      { id: 'm2', название: 'Февраль', дней: 30, сезон: 'Зима' },
    ],
    yearTape: [],
  };

  it('initializes isCollapsed based on extraDaysCount', () => {
    const { isCollapsed } = useTab1ExtraDaysTape(defaultProps);
    expect(isCollapsed.value).toBe(false);

    const collapsedHook = useTab1ExtraDaysTape({
      ...defaultProps,
      extraDaysCount: 0,
    });
    expect(collapsedHook.isCollapsed.value).toBe(true);
  });

  it('computes monthOptions properly', () => {
    const { monthOptions } = useTab1ExtraDaysTape(defaultProps);
    expect(monthOptions.value).toHaveLength(2);
    expect(monthOptions.value[0]).toEqual({ value: '0', label: 'Январь' });
    expect(monthOptions.value[1]).toEqual({ value: '1', label: 'Февраль' });
  });

  it('toggles collapsed state', () => {
    const { isCollapsed, toggleCollapsed } = useTab1ExtraDaysTape(defaultProps);
    expect(isCollapsed.value).toBe(false);
    toggleCollapsed();
    expect(isCollapsed.value).toBe(true);
  });
});

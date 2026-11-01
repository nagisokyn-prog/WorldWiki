import { describe, it, expect } from 'vitest';
import { useTab1MonthsSection } from './useTab1MonthsSection';
import type { Tab1MonthsSectionProps } from './Tab1MonthsSection.model';

describe('useTab1MonthsSection', () => {
  const defaultProps: Tab1MonthsSectionProps = {
    months: [
      { id: '1', название: 'Январь', дней: 31, сезон: 'Зима' },
      { id: '2', название: 'Февраль', дней: 28, сезон: 'Зима' },
      { id: '3', название: 'Март', дней: 31, сезон: 'Весна' },
      { id: '4', название: 'Апрель', дней: 30, сезон: 'Весна' },
    ],
    firstMonthOfYear: 1,
    firstDayOfMonth: 1,
    leapDaysMonthIndex: 1,
    intercalaryRule: 'every_4_years',
    customInterval: 4,
    leapDaysCount: 1,
  };

  it('computes seasonLabels correctly', () => {
    const { seasonLabels } = useTab1MonthsSection(defaultProps);
    expect(seasonLabels.value).toHaveLength(4);
    expect(seasonLabels.value[0]).toBe('❄️ Зима');
    expect(seasonLabels.value[1]).toBe('🌸 Весна');
  });

  it('computes monthOptions correctly', () => {
    const { monthOptions } = useTab1MonthsSection(defaultProps);
    expect(monthOptions.value).toHaveLength(4);
    expect(monthOptions.value[0]).toEqual({ value: '0', label: '1. Январь' });
    expect(monthOptions.value[1]).toEqual({ value: '1', label: '2. Февраль' });
  });

  it('computes maxDaysInSelectedMonth correctly', () => {
    const { maxDaysInSelectedMonth } = useTab1MonthsSection(defaultProps);
    expect(maxDaysInSelectedMonth.value).toBe(28);
  });
});

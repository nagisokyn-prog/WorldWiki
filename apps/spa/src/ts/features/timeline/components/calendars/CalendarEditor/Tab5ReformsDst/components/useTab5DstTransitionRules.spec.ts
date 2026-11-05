import { describe, it, expect } from 'vitest';
import { useTab5DstTransitionRules, OCCURRENCE_OPTIONS } from './useTab5DstTransitionRules';
import type { Tab5DstTransitionRulesProps } from './Tab5DstTransitionRules.model';

describe('useTab5DstTransitionRules', () => {
  const props: Tab5DstTransitionRulesProps = {
    policyConfig: {
      springRule: { month: 3, occurrence: 'last', weekday: 0, time: '02:00', offsetMinutes: 60 },
      autumnRule: { month: 10, occurrence: 'last', weekday: 0, time: '03:00', offsetMinutes: -60 },
    },
    monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь'],
    weekdayNames: ['Воскресенье', 'Понедельник'],
  };

  it('computes monthOptions correctly', () => {
    const { monthOptions } = useTab5DstTransitionRules(props);
    expect(monthOptions.value).toHaveLength(10);
    expect(monthOptions.value[2]).toEqual({ value: '3', label: '3. Март' });
  });

  it('computes weekdayOptions correctly', () => {
    const { weekdayOptions } = useTab5DstTransitionRules(props);
    expect(weekdayOptions.value).toHaveLength(2);
    expect(weekdayOptions.value[0]).toEqual({ value: '0', label: 'Воскресенье' });
  });

  it('provides occurrenceOptions', () => {
    const { occurrenceOptions } = useTab5DstTransitionRules(props);
    expect(occurrenceOptions).toEqual(OCCURRENCE_OPTIONS);
  });
});


import { describe, it, expect } from 'vitest';
import { useTab5ReformsSection, MODE_CARDS } from './useTab5ReformsSection';
import type { Tab5ReformsSectionProps } from './Tab5ReformsSection.model';

describe('useTab5ReformsSection', () => {
  const props: Tab5ReformsSectionProps = {
    mode: 'gap',
    modeBadgeText: 'Выброшенные дни',
    activePreset: null,
    presets: [],
    monthNames: ['Январь', 'Февраль', 'Март'],
    gapParams: { year: 1582, month: 10, droppedStartDay: 5, droppedEndDay: 14, droppedCount: 10 },
    transParams: { year: -46, extraDays: 67, extraMonths: 2 },
    resetParams: { originalYear: 1792, newEpochYear: 1, originalMonth: 9, originalDay: 22 },
    newStyleFirstDayStr: '15.10.1582',
    visualTapeStart: '',
    visualTapeMiddle: '',
    visualTapeEnd: '',
    dualDatingInput: { year: 1600, month: 1, day: 1, calendarStyle: 'old' },
    dualDatingResult: { displayString: '1600-01-01 O.S.', absoluteMinute: 0, deltaDays: 10 },
  };

  it('computes monthOptions properly', () => {
    const { monthOptions } = useTab5ReformsSection(props);
    expect(monthOptions.value).toHaveLength(3);
    expect(monthOptions.value[1]).toEqual({ value: '2', label: '2. Февраль' });
  });

  it('exposes modeCards list', () => {
    const { modeCards } = useTab5ReformsSection(props);
    expect(modeCards).toEqual(MODE_CARDS);
    expect(modeCards).toHaveLength(3);
  });
});


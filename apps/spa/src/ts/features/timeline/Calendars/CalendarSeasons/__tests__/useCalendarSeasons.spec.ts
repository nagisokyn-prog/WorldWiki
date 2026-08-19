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
        ],
      },
    };
  });

  it('adds, moves, removes and toggles months in seasons', () => {
    const hook = useCalendarSeasons(props);

    hook.addSeason();
    expect(props.modelValue.сезоны.length).toBe(2);

    hook.moveItem(0, 1);
    expect(props.modelValue.сезоны[1].название).toBe('Весна');

    expect(hook.isMonthInSeason(1, 0)).toBe(true);

    hook.toggleMonthInSeason(1, 0);
    expect(hook.isMonthInSeason(1, 0)).toBe(false);

    hook.removeSeason(0);
    expect(props.modelValue.сезоны.length).toBe(1);
  });
});

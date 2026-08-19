import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarEras } from '../useCalendarEras';

describe('useCalendarEras', () => {
  let props: any;

  beforeEach(() => {
    props = {
      modelValue: {
        эпохи: [
          { название: 'Эра 1', год_начала: 1, год_конца: 500, обратный_отсчет: false },
          { название: 'Эра 2', год_начала: 501, год_конца: 1000, обратный_отсчет: false },
        ],
      },
    };
  });

  it('adds, moves and removes eras', () => {
    const hook = useCalendarEras(props);

    hook.addEra();
    expect(props.modelValue.эпохи.length).toBe(3);
    expect(props.modelValue.эпохи[2].год_начала).toBe(1001);

    hook.moveItem(0, 1);
    expect(props.modelValue.эпохи[0].название).toBe('Эра 2');

    hook.removeEra(0);
    expect(props.modelValue.эпохи.length).toBe(2);
  });
});

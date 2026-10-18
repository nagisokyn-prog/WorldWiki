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

  it('handles addEra and removeEra when modelValue has no eras array', () => {
    const emptyProps: any = { modelValue: {} };
    const hook = useCalendarEras(emptyProps);

    hook.moveItem(0, 1);
    hook.removeEra(0);
    expect(emptyProps.modelValue.эпохи).toBeUndefined();

    hook.addEra();
    expect(emptyProps.modelValue.эпохи.length).toBe(1);
    expect(emptyProps.modelValue.эпохи[0].год_начала).toBe(1);
    expect(emptyProps.modelValue.эпохи[0].год_конца).toBe(101);
  });

  it('moves items within bounds and ignores out of bounds moves', () => {
    const hook = useCalendarEras(props);

    // Out of bounds up
    hook.moveItem(0, -1);
    expect(props.modelValue.эпохи[0].название).toBe('Эра 1');

    // Valid move down
    hook.moveItem(0, 1);
    expect(props.modelValue.эпохи[0].название).toBe('Эра 2');
    expect(props.modelValue.эпохи[1].название).toBe('Эра 1');

    // Out of bounds down
    hook.moveItem(1, 1);
    expect(props.modelValue.эпохи[1].название).toBe('Эра 1');

    hook.removeEra(0);
    expect(props.modelValue.эпохи.length).toBe(1);

    // addEra on existing array (covers line 20 false branch)
    hook.addEra();
    expect(props.modelValue.эпохи.length).toBe(2);
  });

  it('correctly renames era via onNameInput and synchronizes name aliases', () => {
    const hook = useCalendarEras(props);
    const era = props.modelValue.эпохи[0];
    const event = { target: { value: 'Эпоха Драконов' } } as unknown as Event;

    hook.onNameInput(era, event);
    expect(era.название).toBe('Эпоха Драконов');
    expect((era as any).name).toBe('Эпоха Драконов');
  });
});

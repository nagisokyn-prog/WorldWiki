import { describe, it, expect, vi } from 'vitest';
import { reactive } from 'vue';
import { useCalendarAnchorEvents } from '../useCalendarAnchorEvents';
import type { CalendarAnchorEventsProps } from '../CalendarAnchorEvents.model';

describe('useCalendarAnchorEvents', () => {
  it('adds, moves, and removes anchor events', () => {
    const props = reactive<CalendarAnchorEventsProps>({
      modelValue: {
        название: 'Календарь Мира',
        дней_в_неделе: 7,
        названия_дней_недели: [],
        первый_месяц_года: 0,
        месяцы: [],
        эпохи: [],
        anchor_events: [
          { id: 'evt_1', name: 'Рождество', year: 0, day: 1 }
        ]
      }
    });

    const emit = vi.fn();
    const hook = useCalendarAnchorEvents(props, emit);

    expect(hook.anchorEvents.value.length).toBe(1);

    hook.addEvent();
    expect(hook.anchorEvents.value.length).toBe(2);

    hook.moveItem(0, 1);
    expect(hook.anchorEvents.value[1].name).toBe('Рождество');

    hook.removeEvent(0);
    expect(hook.anchorEvents.value.length).toBe(1);
    expect(hook.anchorEvents.value[0].name).toBe('Рождество');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCalendarSettings } from '../useCalendarSettings';

describe('useCalendarSettings', () => {
  let props: any;
  let emit: any;

  beforeEach(() => {
    emit = vi.fn();
    props = {
      modelValue: {
        настройки_времени: {
          часов_в_сутках: 24,
          минут_в_часе: 60,
          секунд_в_минуте: 60,
          широта: 45,
          учитывать_сезонную_длительность_дня: true,
        },
        day_length_anchor: {
          summer_solstice_hours: 16.0,
          winter_solstice_hours: 8.0,
        },
      },
    };
  });

  it('provides settings and day length anchor', () => {
    const hook = useCalendarSettings(props, emit);

    expect(hook.settings.value.часов_в_сутках).toBe(24);
    expect(hook.dayLengthAnchor.value?.summer_solstice_hours).toBe(16.0);
  });
});

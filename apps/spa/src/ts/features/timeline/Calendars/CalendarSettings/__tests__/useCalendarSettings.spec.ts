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
          учитывать_сезонную_длительность_дня: false,
        },
      },
    };
  });

  it('provides settings and sets day length anchor on seasonal toggle', async () => {
    const hook = useCalendarSettings(props, emit);

    expect(hook.settings.value.часов_в_сутках).toBe(24);

    props.modelValue.настройки_времени.учитывать_сезонную_длительность_дня = true;
    await Promise.resolve();

    expect(hook.dayLengthAnchor.value).toBeDefined();
  });
});

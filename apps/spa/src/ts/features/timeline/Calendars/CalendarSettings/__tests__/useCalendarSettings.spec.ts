import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive, nextTick } from 'vue';
import { useCalendarSettings } from '../useCalendarSettings';

describe('useCalendarSettings', () => {
  let emit: any;

  beforeEach(() => {
    emit = vi.fn();
  });

  it('initializes default settings when настройки_времени is missing', () => {
    const props = {
      modelValue: {},
    };
    const hook = useCalendarSettings(props, emit);

    expect(hook.settings.value).toEqual({
      часов_в_сутках: 24,
      минут_в_часе: 60,
      секунд_в_минуте: 60,
      широта: 45,
      учитывать_сезонную_длительность_дня: false,
    });

    // Test calendar setter (covers line 14)
    hook.calendar.value = { name: 'Updated Calendar' } as any;
    expect(emit).toHaveBeenCalledWith('update:modelValue', { name: 'Updated Calendar' });
  });

  it('triggers watcher and creates day_length_anchor when seasonal duration is enabled', async () => {
    const props = reactive({
      modelValue: {
        настройки_времени: {
          учитывать_сезонную_длительность_дня: false,
        },
      },
    });

    const hook = useCalendarSettings(props, emit);
    expect(hook.dayLengthAnchor.value).toBeUndefined();

    props.modelValue.настройки_времени.учитывать_сезонную_длительность_дня = true;
    await nextTick();

    expect(hook.dayLengthAnchor.value).toEqual({
      summer_solstice_hours: 16.0,
      winter_solstice_hours: 8.0,
    });

    // When day_length_anchor already exists, watcher does not overwrite
    props.modelValue.day_length_anchor = {
      summer_solstice_hours: 18.0,
      winter_solstice_hours: 6.0,
    };
    props.modelValue.настройки_времени.учитывать_сезонную_длительность_дня = false;
    await nextTick();
    props.modelValue.настройки_времени.учитывать_сезонную_длительность_дня = true;
    await nextTick();
    expect(hook.dayLengthAnchor.value.summer_solstice_hours).toBe(18.0);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactive, nextTick } from 'vue';
import { useCalendarSettings } from '../useCalendarSettings';

describe('useCalendarSettings', () => {
  let emit: any;

  beforeEach(() => {
    emit = vi.fn();
  });

  it('initializes default settings when настройки_времени is missing', () => {
    const props: any = {
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
  });

  it('triggers watcher and creates day_length_anchor when seasonal duration is enabled', async () => {
    const props = reactive({
      modelValue: {
        настройки_времени: {
          учитывать_сезонную_длительность_дня: false,
        },
      },
    }) as any;

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
    expect(hook.dayLengthAnchor.value!.summer_solstice_hours).toBe(18.0);
  });

  it('provides dynamic title based on isMaster and handles tooltip toggle', () => {
    const masterProps: any = {
      modelValue: {},
      isMaster: true,
    };
    const masterHook = useCalendarSettings(masterProps, emit);
    expect(masterHook.title.value).toBe('🪐 Физика планеты и эталон времени');

    const localProps: any = {
      modelValue: {},
      isMaster: false,
    };
    const localHook = useCalendarSettings(localProps, emit);
    expect(localHook.title.value).toBe('⏱️ Местное деление времени');
    expect(localHook.showTooltip.value).toBe(false);

    localHook.toggleTooltip();
    expect(localHook.showTooltip.value).toBe(true);

    localHook.toggleTooltip();
    expect(localHook.showTooltip.value).toBe(false);
  });
});

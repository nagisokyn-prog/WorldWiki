import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { usePromiseDateTime } from './usePromiseDateTime';
import type { CalendarRecord } from '@/stores/calendar.store';

describe('usePromiseDateTime', () => {
  const calendars = ref<CalendarRecord[]>([
    {
      id: 'cal:1',
      name: 'Основной календарь',
      is_default: true,
      data: {
        название: 'Основной календарь',
        эпохи: [{ название: 'Новая Эра', год_начала: 1, год_конца: 2000 }],
        месяцы: [
          { название: 'Январь', дней: 30 },
          { название: 'Февраль', дней: 30 }
        ],
        сезоны: [{ название: 'Зима', месяцы: [0, 1] }],
        настройки_времени: { часов_в_сутках: 24, минут_в_часе: 60 }
      }
    }
  ]);

  it('toggles date picker open state', () => {
    const emitChange = vi.fn();
    const dt = usePromiseDateTime(calendars, emitChange);

    expect(dt.isDatePickerOpen.value).toBe(false);
    dt.toggleDatePicker();
    expect(dt.isDatePickerOpen.value).toBe(true);
    dt.toggleDatePicker();
    expect(dt.isDatePickerOpen.value).toBe(false);
  });

  it('updates fields and emits change on date fields change', () => {
    const emitChange = vi.fn();
    const dt = usePromiseDateTime(calendars, emitChange);

    dt.currentHour.value = 15;
    dt.currentMinute.value = 30;
    dt.onDateFieldsChange();

    expect(emitChange).toHaveBeenCalled();
    expect(dt.universalDateModel.value?.original_input.hour).toBe(15);
  });

  it('calculates diegetic time of day correctly', () => {
    const emitChange = vi.fn();
    const dt = usePromiseDateTime(calendars, emitChange);

    dt.currentHour.value = 2;
    expect(dt.diegeticInfo.value?.timeOfDayName).toBe('🌙 Ночь');

    dt.currentHour.value = 9;
    expect(dt.diegeticInfo.value?.timeOfDayName).toBe('🌅 Утро');

    dt.currentHour.value = 14;
    expect(dt.diegeticInfo.value?.timeOfDayName).toBe('☀️ День');

    dt.currentHour.value = 20;
    expect(dt.diegeticInfo.value?.timeOfDayName).toBe('🌇 Вечер');
  });
});

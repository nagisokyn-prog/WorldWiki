import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { usePromiseDateHelpers } from './usePromiseDateHelpers';
import { CalendarFormat } from '@/services/Calendars/calendar.format';

describe('usePromiseDateHelpers', () => {
  it('computes wheel options, seasons, timeOfDay, and diegeticInfo across edge cases', () => {
    const calData = {
      ...CalendarFormat.getDefaultCalendar(),
      сезоны: [
        { название: 'Весна', месяцы: [0] },
        { название: 'Лето', месяцы: [1] },
        { название: 'Осень', месяцы: [2] },
        { название: 'Зима', месяцы: [3] },
      ],
    } as any;

    const activeCal = ref<any>({ id: '', name: '', data: calData });
    const months = ref<any[]>([
      { название: 'М1' },
      { название: 'М2' },
      { название: 'М3' },
      { название: 'М4' },
      { название: '' },
    ]);
    const eras = ref<any[]>([
      { название: '', name: '' },
      { name: 'Вторая', год_начала: undefined, год_конца: undefined },
    ]);
    const maxDays = ref(30);
    const year = ref(200); // > minStart + 100
    const eraIdx = ref(0);
    const monthIdx = ref(0);
    const day = ref(1);
    const hour = ref(8);
    const minute = ref(15);

    const helpers = usePromiseDateHelpers(
      activeCal,
      months,
      eras,
      maxDays,
      year,
      eraIdx,
      monthIdx,
      day,
      hour,
      minute,
      (c) => c?.data ?? null
    );

    expect(helpers.eraWheelOptions.value[0].label).toBe('Эпоха 1');
    expect(helpers.monthWheelOptions.value[4].label).toBe('Месяц 5');
    expect(Array.isArray(helpers.yearWheelOptions.value)).toBe(true);

    expect(helpers.diegeticInfo.value?.seasonClass).toBe('season-spring');
    monthIdx.value = 1;
    hour.value = 14;
    expect(helpers.diegeticInfo.value?.seasonClass).toBe('season-summer');
    monthIdx.value = 2;
    hour.value = 20;
    expect(helpers.diegeticInfo.value?.seasonClass).toBe('season-autumn');
    monthIdx.value = 3;
    hour.value = 2;
    expect(helpers.diegeticInfo.value?.seasonClass).toBe('season-winter');

    // Out-of-range eraIdx & empty calendar guard
    eraIdx.value = 99;
    expect(helpers.eraMinYear.value).toBe(1);
    activeCal.value = null;
    expect(helpers.diegeticInfo.value).toBeNull();
  });
});

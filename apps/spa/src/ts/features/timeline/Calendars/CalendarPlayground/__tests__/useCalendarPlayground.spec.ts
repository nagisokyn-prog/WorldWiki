import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarPlayground } from '../useCalendarPlayground';

describe('useCalendarPlayground', () => {
  let props: any;

  beforeEach(() => {
    props = {
      calendar: {
        месяцы: [
          { название: 'Месяц 1', дней: 30 },
          { название: 'Месяц 2', дней: 30 },
        ],
        дней_в_неделе: 7,
        названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
        точка_отсчета: {
          эпоха: 0,
          год: 1,
          месяц: 0,
          день: 1,
          день_недели: 0,
        },
        настройки_времени: {
          часов_в_сутках: 24,
          минут_в_часе: 60,
        },
        праздники: [
          {
            название: 'День Мира',
            дата_начала: { месяц: 0, день: 1 },
            дата_конца: { месяц: 0, день: 2 },
          },
        ],
      },
    };
  });

  it('navigates months and computes days count', () => {
    const hook = useCalendarPlayground(props);

    expect(hook.currentDaysCount.value).toBe(30);

    hook.nextMonth();
    expect(hook.origin.value.месяц).toBe(1);

    hook.prevMonth();
    expect(hook.origin.value.месяц).toBe(0);
  });

  it('gets holiday for date', () => {
    const hook = useCalendarPlayground(props);
    const holiday = hook.getHolidayForDate(props.calendar, 1, 0, 1);

    expect(holiday).toBeDefined();
    expect(holiday?.название).toBe('День Мира');
  });
});

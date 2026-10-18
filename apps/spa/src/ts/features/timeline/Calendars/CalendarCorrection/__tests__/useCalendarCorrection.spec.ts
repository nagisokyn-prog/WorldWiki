/**
 * @file useCalendarCorrection.spec.ts
 * @description Unit-тесты для хука useCalendarCorrection (унификация високосов и праздничных дней).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCalendarCorrection } from '../useCalendarCorrection';
import type { CalendarData } from '../../../../../services/Calendars/calendar.types';

describe('useCalendarCorrection', () => {
  let mockCalendar: CalendarData;

  beforeEach(() => {
    mockCalendar = {
      название: 'Тестовый Календарь',
      дней_в_неделе: 7,
      названия_дней_недели: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      первый_месяц_года: 0,
      месяцы: [
        { название: 'Январь', дней: 31 },
        { название: 'Февраль', дней: 28 },
        { название: 'Март', дней: 31 },
      ],
      эпохи: [],
    };
  });

  it('инициализирует дефолтные структуры, если они отсутствуют', () => {
    const emit = vi.fn();
    const hook = useCalendarCorrection({ modelValue: mockCalendar }, emit);

    expect(hook.config.value).toBeDefined();
    expect(hook.baseExtraDays.value).toBe(0);
    expect(hook.pauseWeekdays.value).toBe(false);
    expect(hook.ruleType.value).toBe('григорианское');
    expect(hook.targetMode.value).toBe('in_month');
    expect(hook.targetMonthIndex.value).toBe(1);
    expect(hook.leapDaysOffset.value).toBe(1);
  });

  it('корректно обновляет базовые праздничные дни и синхронизирует legacy поле extra_days', () => {
    const emit = vi.fn();
    const hook = useCalendarCorrection({ modelValue: mockCalendar }, emit);

    hook.baseExtraDays.value = 5;
    expect(hook.baseExtraDays.value).toBe(5);
    expect(mockCalendar.extra_days).toBe(5);
    expect(emit).toHaveBeenCalledWith('update:modelValue', mockCalendar);

    // Запрет отрицательных дней
    hook.baseExtraDays.value = -3;
    expect(hook.baseExtraDays.value).toBe(0);
    expect(mockCalendar.extra_days).toBe(0);
  });

  it('корректно переключает заморозку дней недели и обновляет название блока', () => {
    const emit = vi.fn();
    const hook = useCalendarCorrection({ modelValue: mockCalendar }, emit);

    hook.pauseWeekdays.value = true;
    expect(hook.pauseWeekdays.value).toBe(true);
    expect(mockCalendar.pause_weekdays_on_extra_days).toBe(true);

    hook.extraDaysName.value = 'Праздники Лите';
    expect(hook.extraDaysName.value).toBe('Праздники Лите');
    expect(emit).toHaveBeenCalled();
  });

  it('управляет целью високосной надбавки и целевым месяцем', () => {
    const emit = vi.fn();
    const hook = useCalendarCorrection({ modelValue: mockCalendar }, emit);

    hook.targetMode.value = 'in_extra_days';
    expect(hook.targetMode.value).toBe('in_extra_days');

    hook.targetMonthIndex.value = 2;
    expect(hook.targetMonthIndex.value).toBe(2);
    expect(mockCalendar.пользовательское_високосное_правило?.месяц).toBe(2);

    hook.leapDaysOffset.value = 3;
    expect(hook.leapDaysOffset.value).toBe(3);
    expect(mockCalendar.пользовательское_високосное_правило?.день_смещения).toBe(3);
  });

  it('добавляет, изменяет и удаляет гармоники кастомного правила', () => {
    const emit = vi.fn();
    const hook = useCalendarCorrection({ modelValue: mockCalendar }, emit);

    hook.ruleType.value = 'пользовательское';
    mockCalendar.високосные_правила = [];

    // Добавляем гармонику +1 каждые 10 лет
    hook.addHarmonic(1, 10);
    expect(mockCalendar.високосные_правила).toHaveLength(1);
    expect(mockCalendar.високосные_правила[0].divisor_c).toBe(10);
    expect(mockCalendar.високосные_правила[0].weight).toBe(1);

    // Добавляем исключение -1 каждые 20 лет
    hook.addHarmonic(-1, 20);
    expect(mockCalendar.високосные_правила).toHaveLength(2);
    expect(mockCalendar.високосные_правила[1].divisor_c).toBe(20);
    expect(mockCalendar.високосные_правила[1].weight).toBe(-1);

    // Изменяем делитель
    hook.updateHarmonicDivisor(1, 25);
    expect(mockCalendar.високосные_правила[1].divisor_c).toBe(25);

    // Удаляем первую гармонику
    hook.removeHarmonic(0);
    expect(mockCalendar.високосные_правила).toHaveLength(1);
    expect(mockCalendar.високосные_правила[0].divisor_c).toBe(25);
  });

  it('корректно применяет готовые шаблоны-пресеты', () => {
    const emit = vi.fn();
    const hook = useCalendarCorrection({ modelValue: mockCalendar }, emit);

    // Пресет Толкина (Шир)
    hook.applyPreset('tolkien');
    expect(hook.ruleType.value).toBe('каждый 4 год');
    expect(hook.targetMode.value).toBe('in_extra_days');
    expect(hook.baseExtraDays.value).toBe(5);
    expect(hook.pauseWeekdays.value).toBe(true);
    expect(hook.extraDaysName.value).toContain('Лите');

    // Пресет Древнего Египта
    hook.applyPreset('egyptian');
    expect(hook.ruleType.value).toBe('каждый 4 год');
    expect(hook.targetMode.value).toBe('in_extra_days');
    expect(hook.pauseWeekdays.value).toBe(false);
    expect(hook.extraDaysName.value).toContain('богов');

    // Пресет Кастомный пример (+3 каждые 10/20/200 лет)
    hook.applyPreset('custom_example');
    expect(hook.ruleType.value).toBe('пользовательское');
    expect(hook.targetMode.value).toBe('in_extra_days');
    expect(hook.leapDaysOffset.value).toBe(3);
    expect(mockCalendar.високосные_правила).toHaveLength(3);
    expect(mockCalendar.високосные_правила?.[0].divisor_c).toBe(10);
    expect(mockCalendar.високосные_правила?.[1].divisor_c).toBe(20);
    expect(mockCalendar.високосные_правила?.[2].divisor_c).toBe(200);

    // Пресет Григорианский
    hook.applyPreset('gregorian');
    expect(hook.ruleType.value).toBe('григорианское');
    expect(hook.targetMode.value).toBe('in_month');
    expect(hook.targetMonthIndex.value).toBe(1);
    expect(hook.baseExtraDays.value).toBe(0);
  });

  it('рассчитывает общую базовую длительность года и вековой дрейф', () => {
    const hook = useCalendarCorrection({ modelValue: mockCalendar });

    // Месяцы: 31 + 28 + 31 = 90
    expect(hook.totalBaseYearDays.value).toBe(90);

    hook.baseExtraDays.value = 5;
    expect(hook.totalBaseYearDays.value).toBe(95);

    expect(typeof hook.driftPerCentury.value).toBe('number');
  });

  it('генерирует выборку ближайших лет для живого инспектора', () => {
    const hook = useCalendarCorrection({ modelValue: mockCalendar });
    const sample = hook.sampleUpcomingYears.value;

    expect(sample.length).toBeGreaterThan(0);
    expect(sample[0]).toHaveProperty('year');
    expect(sample[0]).toHaveProperty('isLeap');
    expect(sample[0]).toHaveProperty('daysAdded');
  });

  it('управляет позицией дней вне месяцев и формирует визуальную шкалу года', () => {
    const emit = vi.fn();
    const hook = useCalendarCorrection({ modelValue: mockCalendar }, emit);

    hook.baseExtraDays.value = 5;

    // 1. По умолчанию в конце года
    hook.placement.value = 'end_of_year';
    let timeline = hook.yearTimeline.value;
    expect(timeline[timeline.length - 1].type).toBe('extra_days');

    // 2. В начале года
    hook.placement.value = 'start_of_year';
    timeline = hook.yearTimeline.value;
    expect(timeline[0].type).toBe('extra_days');

    // 3. В середине года (mid_year)
    hook.placement.value = 'mid_year';
    timeline = hook.yearTimeline.value;
    expect(timeline[1].type).toBe('extra_days');

    // 4. После конкретного месяца (after_month)
    hook.placement.value = 'after_month';
    hook.afterMonthIndex.value = 0; // После января
    timeline = hook.yearTimeline.value;
    expect(timeline[0].name).toBe('Январь');
    expect(timeline[1].type).toBe('extra_days');
    expect(timeline[2].name).toBe('Февраль');
  });

  it('рассчитывает математические рекомендации (convergents) и позволяет применить их', () => {
    const emit = vi.fn();
    mockCalendar.target_year_length_days = 365.2422;
    const hook = useCalendarCorrection({ modelValue: mockCalendar }, emit);

    expect(hook.isSuggestOpen.value).toBe(false);
    hook.toggleSuggestions();
    expect(hook.isSuggestOpen.value).toBe(true);

    const suggestions = hook.leapSuggestions.value;
    expect(suggestions.length).toBeGreaterThan(0);

    // Первое приближение для 0.2422 -> 1/4 (каждые 4 года)
    expect(suggestions[0].cycleYears).toBe(4);
    expect(suggestions[0].leapYears).toBe(1);

    // Применяем рекомендацию
    hook.applySuggestion(suggestions[0]);
    expect(hook.ruleType.value).toBe('каждый 4 год');
    expect(hook.isSuggestOpen.value).toBe(false);
    expect(emit).toHaveBeenCalled();
  });
});

/**
 * @file useCalendarCorrection.spec.ts
 * @description Unit-тесты для хука useCalendarCorrection (унификация високосов и праздничных дней).
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { reactive } from 'vue';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initSync } from '@worldwiki/calendar-wasm';
import { useCalendarCorrection, decomposeFractionToUnitHarmonics } from '../useCalendarCorrection';
import type { CalendarData } from '../../../../../services/Calendars/calendar.types';

describe('useCalendarCorrection', () => {
  let mockCalendar: CalendarData;

  beforeAll(() => {
    const possiblePaths = [
      resolve(__dirname, '../../../../../../../../../packages/calendar-wasm/pkg/worldwiki_calendar_wasm_bg.wasm'),
      resolve(__dirname, '../../../../../../../../packages/calendar-wasm/pkg/worldwiki_calendar_wasm_bg.wasm'),
      resolve(process.cwd(), 'packages/calendar-wasm/pkg/worldwiki_calendar_wasm_bg.wasm'),
      resolve(process.cwd(), '../../packages/calendar-wasm/pkg/worldwiki_calendar_wasm_bg.wasm'),
    ];
    const wasmPath = possiblePaths.find(existsSync);
    if (wasmPath) {
      const bytes = readFileSync(wasmPath);
      initSync(bytes);
    }
  });

  beforeEach(() => {
    mockCalendar = reactive<CalendarData>({
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
    });
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

    // Применяем рекомендацию простого правила
    hook.applySuggestion(suggestions[0]);
    expect(hook.ruleType.value).toBe('каждый 4 год');
    expect(hook.isSuggestOpen.value).toBe(false);
    expect(emit).toHaveBeenCalled();

    // Проверяем приближение цикла Медлера (128 лет, дрейф ~0.000 сут/век)
    const madler = suggestions.find((s) => s.cycleYears === 128);
    expect(madler).toBeDefined();
    expect(madler!.harmonics).toHaveLength(2);
    expect(madler!.harmonics?.[0].divisor_c).toBe(4);
    expect(madler!.harmonics?.[0].weight).toBe(1);
    expect(madler!.harmonics?.[1].divisor_c).toBe(128);
    expect(madler!.harmonics?.[1].weight).toBe(-1);

    // Применяем Медлера — должны установиться ровно 2 понятных условия
    hook.applySuggestion(madler!);
    expect(hook.ruleType.value).toBe('пользовательское');
    expect(mockCalendar.високосные_правила).toHaveLength(2);
    expect(mockCalendar.високосные_правила?.[0].divisor_c).toBe(4);
    expect(mockCalendar.високосные_правила?.[1].divisor_c).toBe(128);
  });

  it('универсально раскладывает дробь любой планеты в единичные гармоники без хардкода', () => {
    // Марс (3/5 -> +2, +10)
    const marsHarmonics = decomposeFractionToUnitHarmonics(3, 5);
    expect(marsHarmonics).toHaveLength(2);
    expect(marsHarmonics[0]).toEqual({ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 2 });
    expect(marsHarmonics[1]).toEqual({ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 10 });

    // Иная планета (2/7 -> +4, +28)
    const alienHarmonics = decomposeFractionToUnitHarmonics(2, 7);
    expect(alienHarmonics.length).toBeGreaterThanOrEqual(1);
    expect(alienHarmonics.every((h) => Math.abs(h.weight) === 1 && h.multiplier_a === 1)).toBe(true);
  });

  it('универсально балансирует дни месяцев под праздники для любой орбиты', () => {
    const emit = vi.fn();
    mockCalendar.target_year_length_days = 687.2; // Марсианская орбита
    mockCalendar.месяцы = Array.from({ length: 10 }, (_, i) => ({ название: `M${i + 1}`, дней: 70 }));
    const hook = useCalendarCorrection({ modelValue: mockCalendar }, emit);

    hook.baseExtraDays.value = 7;
    hook.balanceMonthsForExtraDays();

    // 687 - 7 = 680 дней в месяцах: 680 / 10 = 68 дней в каждом месяце
    expect(mockCalendar.месяцы.every((m) => m.дней === 68)).toBe(true);
    expect(hook.totalBaseYearDays.value).toBe(687);
  });
});

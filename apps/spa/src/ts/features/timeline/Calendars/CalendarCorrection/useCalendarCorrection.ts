/**
 * @file useCalendarCorrection.ts
 * @description Логика управления календарной коррекцией (високосы, эпагомены/праздничные дни вне месяцев, гармоники делимости и дрейф).
 */

import { ref, computed } from 'vue';
import type {
  CalendarCorrectionProps,
  CalendarCorrectionEmits,
  UpcomingLeapYear,
  ExtraDaysPlacement,
  YearTimelineItem,
  LeapSuggestion,
} from './CalendarCorrection.model';
import { useCalendarEngine } from '../../../../services/Calendars/useCalendarEngine';
import { useCalendarStore } from '../../../../stores/calendar.store';
import { CalendarWasmBridge } from '../../../../services/Calendars/calendar.wasm-bridge';
import type { CalendarData, ExtraDaysConfig, LeapHarmonic, PlanetEntity } from '../../../../services/Calendars/calendar.types';

/**
 * Разложение рациональной дроби p/q в знаковые единичные гармоники sum_i (w_i / c_i).
 * Выполняется строго в ядре Rust через CalendarWasmBridge.
 */
export function decomposeFractionToUnitHarmonics(
  p: number,
  q: number,
  maxHarmonics: number = 3
): LeapHarmonic[] {
  return CalendarWasmBridge.decomposeFractionToUnitHarmonics(p, q, maxHarmonics);
}

function formatHarmonicsDescription(harmonics: LeapHarmonic[]): string {
  if (harmonics.length === 0) return 'Без високосов';
  if (harmonics.length === 1) {
    const h = harmonics[0];
    return `Каждые ${h.divisor_c} ${h.divisor_c === 4 ? 'года' : 'лет'}: +1 день`;
  }
  if (harmonics.length === 2) {
    const [h1, h2] = harmonics;
    const signWord = h2.weight > 0 ? 'плюс' : 'кроме';
    const signVal = h2.weight > 0 ? '+1' : '-1';
    return `Каждые ${h1.divisor_c} ${h1.divisor_c === 4 ? 'года' : 'лет'} (+1), ${signWord} кратных ${h2.divisor_c} (${signVal})`;
  }
  return harmonics.map((h, i) => {
    if (i === 0) return `Каждые ${h.divisor_c} лет (+1)`;
    const signWord = h.weight > 0 ? 'плюс' : 'кроме';
    return `${signWord} кратных ${h.divisor_c}`;
  }).join(', ');
}

function getSuggestionMeta(
  harmonics: LeapHarmonic[],
  ly: number,
  cy: number
): { description: string; rulePreset: 'gregorian' | 'simple_4' | 'custom' } {
  if (cy === 4 && ly === 1) {
    return {
      description: 'Простое правило: каждые 4 года +1 день (Юлианский)',
      rulePreset: 'simple_4',
    };
  }
  if (cy === 400 && ly === 97) {
    return {
      description: 'Григорианский стандарт: каждые 4 года (+1), кроме 100 (-1), плюс 400 (+1)',
      rulePreset: 'gregorian',
    };
  }
  if (cy === 128 && ly === 31) {
    return {
      description: 'Цикл Медлера: каждые 4 года (+1), кроме 128 (-1). Точность: 1 день ошибки за 100 000 лет!',
      rulePreset: 'custom',
    };
  }
  if (cy === 33 && ly === 8) {
    return {
      description: 'Персидский цикл (Омар Хайям): каждые 4 года (+1), кроме 132 (-1)',
      rulePreset: 'custom',
    };
  }
  return {
    description: formatHarmonicsDescription(harmonics),
    rulePreset: 'custom',
  };
}

export function useCalendarCorrection(
  props: CalendarCorrectionProps,
  emit?: CalendarCorrectionEmits,
) {
  const isCollapsed = ref(false);
  const engine = useCalendarEngine();

  // Инициализация конфигурации
  const ensureConfig = () => {
    if (!props.modelValue) return;

    if (!props.modelValue.extra_days_config) {
      props.modelValue.extra_days_config = {
        base_days: props.modelValue.extra_days ?? props.modelValue.epagomenal_config?.extra_days_base ?? 0,
        leap_days: props.modelValue.epagomenal_config?.extra_days_leap ?? 1,
        pause_weekdays: props.modelValue.pause_weekdays_on_extra_days ?? props.modelValue.epagomenal_config?.pause_on_extra_days ?? false,
        name: props.modelValue.epagomenal_config?.name ?? 'Праздничные дни вне месяцев',
        target_mode: 'in_month',
        target_month_index: props.modelValue.пользовательское_високосное_правило?.месяц ?? 1,
        placement: 'end_of_year',
        after_month_index: 0,
      };
    } else {
      if (!props.modelValue.extra_days_config.placement) {
        props.modelValue.extra_days_config.placement = 'end_of_year';
      }
      if (props.modelValue.extra_days_config.after_month_index === undefined) {
        props.modelValue.extra_days_config.after_month_index = 0;
      }
    }

    if (!props.modelValue.правило_високосного_года) {
      props.modelValue.правило_високосного_года = 'григорианское';
    }

    if (!props.modelValue.пользовательское_високосное_правило) {
      props.modelValue.пользовательское_високосное_правило = {
        месяц: props.modelValue.extra_days_config.target_month_index ?? 1,
        день_смещения: props.modelValue.extra_days_config.leap_days ?? 1,
        период: 4,
      };
    } else if (props.modelValue.пользовательское_високосное_правило.день_смещения === 29) {
      props.modelValue.пользовательское_високосное_правило.день_смещения = 1;
    }

    if (props.modelValue.extra_days_config.leap_days === 29) {
      props.modelValue.extra_days_config.leap_days = 1;
    }

    if (!props.modelValue.високосные_правила) {
      props.modelValue.високосные_правила = [
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
      ];
    }
  };

  // Инициализируем конфигурацию сразу при создании хука
  ensureConfig();

  const config = computed<ExtraDaysConfig>(() => {
    ensureConfig();
    return props.modelValue.extra_days_config!;
  });

  // Правило високосного года
  const ruleType = computed({
    get: () => props.modelValue.правило_високосного_года || 'григорианское',
    set: (val: string) => {
      props.modelValue.правило_високосного_года = val;
      emit?.('update:modelValue', props.modelValue);
    },
  });

  // Базовые праздничные дни вне месяцев
  const baseExtraDays = computed({
    get: () => config.value.base_days,
    set: (val: number) => {
      config.value.base_days = Math.max(0, val);
      props.modelValue.extra_days = config.value.base_days;
      emit?.('update:modelValue', props.modelValue);
    },
  });

  // Название блока дней вне месяцев
  const extraDaysName = computed({
    get: () => config.value.name,
    set: (val: string) => {
      config.value.name = val;
      emit?.('update:modelValue', props.modelValue);
    },
  });

  // Заморозка дней недели
  const pauseWeekdays = computed({
    get: () => config.value.pause_weekdays,
    set: (val: boolean) => {
      config.value.pause_weekdays = val;
      props.modelValue.pause_weekdays_on_extra_days = val;
      emit?.('update:modelValue', props.modelValue);
    },
  });

  // Позиция размещения праздничного блока
  const placement = computed({
    get: (): ExtraDaysPlacement => config.value.placement || 'end_of_year',
    set: (val: ExtraDaysPlacement) => {
      config.value.placement = val;
      emit?.('update:modelValue', props.modelValue);
    },
  });

  // Индекс месяца, после которого вставлять дни (если placement === 'after_month')
  const afterMonthIndex = computed({
    get: () => config.value.after_month_index ?? 0,
    set: (val: number) => {
      config.value.after_month_index = val;
      emit?.('update:modelValue', props.modelValue);
    },
  });

  // Визуальная шкала последовательности месяцев и праздников в году
  const yearTimeline = computed<YearTimelineItem[]>(() => {
    const months = props.modelValue.месяцы || [];
    const hasExtra = baseExtraDays.value > 0;
    const extraItem: YearTimelineItem = {
      id: 'extra_days_block',
      type: 'extra_days',
      name: extraDaysName.value || 'Праздничные дни',
      days: baseExtraDays.value,
      leapDaysAdded: targetMode.value === 'in_extra_days' ? leapDaysOffset.value : 0,
      isLeapTarget: targetMode.value === 'in_extra_days',
    };

    const monthItems: YearTimelineItem[] = months.map((m, idx) => ({
      id: `month_${idx}`,
      type: 'month',
      name: m.название || `Месяц ${idx + 1}`,
      days: m.дней,
      leapDaysAdded: (targetMode.value === 'in_month' && targetMonthIndex.value === idx) ? leapDaysOffset.value : 0,
      isLeapTarget: targetMode.value === 'in_month' && targetMonthIndex.value === idx,
      monthIndex: idx,
    }));

    if (!hasExtra) {
      return monthItems;
    }

    const place = placement.value;
    if (place === 'start_of_year') {
      return [extraItem, ...monthItems];
    }
    if (place === 'mid_year') {
      const mid = Math.floor(monthItems.length / 2);
      return [
        ...monthItems.slice(0, mid),
        extraItem,
        ...monthItems.slice(mid),
      ];
    }
    if (place === 'after_month') {
      const splitIdx = Math.min(Math.max(0, afterMonthIndex.value + 1), monthItems.length);
      return [
        ...monthItems.slice(0, splitIdx),
        extraItem,
        ...monthItems.slice(splitIdx),
      ];
    }
    // 'end_of_year' по умолчанию
    return [...monthItems, extraItem];
  });

  // Цель надбавки ('in_month' или 'in_extra_days')
  const targetMode = computed({
    get: () => config.value.target_mode,
    set: (val: 'in_month' | 'in_extra_days') => {
      config.value.target_mode = val;
      emit?.('update:modelValue', props.modelValue);
    },
  });

  // Месяц для надбавки (0-индексация)
  const targetMonthIndex = computed({
    get: () => config.value.target_month_index ?? props.modelValue.пользовательское_високосное_правило?.месяц ?? 1,
    set: (val: number) => {
      config.value.target_month_index = val;
      if (props.modelValue.пользовательское_високосное_правило) {
        props.modelValue.пользовательское_високосное_правило.месяц = val;
      }
      emit?.('update:modelValue', props.modelValue);
    },
  });

  // Количество високосных дней надбавки (+1, +3 и т.д.)
  const leapDaysOffset = computed({
    get: () => config.value.leap_days || props.modelValue.пользовательское_високосное_правило?.день_смещения || 1,
    set: (val: number) => {
      const positiveVal = Math.max(1, val);
      config.value.leap_days = positiveVal;
      if (props.modelValue.пользовательское_високосное_правило) {
        props.modelValue.пользовательское_високосное_правило.день_смещения = positiveVal;
      }
      emit?.('update:modelValue', props.modelValue);
    },
  });

  // Активные гармоники
  const currentHarmonics = computed<LeapHarmonic[]>(() => {
    const rule = ruleType.value;
    if (rule === 'григорианское' || rule === 'григорианский') {
      return [
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
        { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
      ];
    }
    if (rule === 'каждый 4 год') {
      return [{ weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 }];
    }
    if (rule === 'пользовательское') {
      return props.modelValue.високосные_правила || [];
    }
    return [];
  });

  // Добавление новой гармоники
  const addHarmonic = (weight: number = 1, divisor: number = 4) => {
    if (!props.modelValue.високосные_правила) {
      props.modelValue.високосные_правила = [];
    }
    props.modelValue.високосные_правила.push({
      weight,
      multiplier_a: 1,
      shift_b: 0,
      divisor_c: Math.max(1, divisor),
    });
    emit?.('update:modelValue', props.modelValue);
  };

  // Удаление гармоники
  const removeHarmonic = (index: number) => {
    if (props.modelValue.високосные_правила && index >= 0 && index < props.modelValue.високосные_правила.length) {
      props.modelValue.високосные_правила.splice(index, 1);
      emit?.('update:modelValue', props.modelValue);
    }
  };

  // Изменение периода гармоники
  const updateHarmonicDivisor = (index: number, divisor: number) => {
    if (props.modelValue.високосные_правила?.[index]) {
      props.modelValue.високосные_правила[index].divisor_c = Math.max(1, divisor);
      emit?.('update:modelValue', props.modelValue);
    }
  };

  // Полная базовая продолжительность года (месяцы + праздничные дни вне месяцев)
  const totalBaseYearDays = computed(() => {
    const monthsDays = props.modelValue.месяцы?.reduce((acc, m) => acc + (m.дней || 0), 0) || 365;
    return monthsDays + baseExtraDays.value;
  });

  // Орбитальные сутки целевой планеты
  const targetOrbitalDays = computed(() => {
    const cal = props.modelValue as CalendarData & { target_year_length_days?: number };
    if (cal.target_year_length_days) return cal.target_year_length_days;
    try {
      const store = useCalendarStore();
      const projId = (cal as Record<string, unknown>).project_id;
      const projectName = typeof projId === 'string' ? projId : 'default';
      const planetsList = store.getPlanets(projectName);
      if (cal.planet_id && planetsList) {
        const p = planetsList.find((pl: PlanetEntity) => pl.id === cal.planet_id);
        if (p?.orbit_days) return p.orbit_days;
      }
    } catch {
      // Pinia can be inactive in standalone test environment
    }
    return 365.24219;
  });

  // Расчёт векового дрейфа
  const driftPerCentury = computed(() => {
    return engine.calculateDriftPerCentury(totalBaseYearDays.value, currentHarmonics.value, targetOrbitalDays.value);
  });

  // Предупреждение о вековом дрейфе
  const driftWarning = computed(() => {
    const monthsDays = props.modelValue.месяцы?.reduce((acc, m) => acc + (m.дней || 0), 0) || 0;
    const extra = baseExtraDays.value;
    const baseTotal = monthsDays + extra;
    const orbit = targetOrbitalDays.value;
    const expectedBase = Math.floor(orbit);

    if (baseTotal !== expectedBase) {
      const diff = baseTotal - expectedBase;
      if (diff > 0) {
        return `Базовый год (${baseTotal} дн.: ${monthsDays} в месяцах + ${extra} праздничных) на ${diff} дн. длиннее орбитального года планеты (${orbit.toFixed(1)} сут.). Високосы не смогут это исправить — уменьшите дни в месяцах (например, сделайте ${expectedBase - extra} дн.) или сократите праздники.`;
      } else {
        const missing = Math.abs(diff);
        return `Базовый год (${baseTotal} дн.: ${monthsDays} в месяцах + ${extra} праздничных) на ${missing} дн. короче орбитального года планеты (${orbit.toFixed(1)} сут.). Добавьте недостающие дни в месяцы или праздники.`;
      }
    }

    const drift = driftPerCentury.value;
    if (Math.abs(drift) > 1.0) {
      const sign = drift > 0 ? '+' : '';
      return `Вековое расхождение: ${sign}${drift.toFixed(2)} сут. за 100 лет относительно орбиты планеты (${orbit.toFixed(4)} сут.).`;
    }
    return null;
  });

  const isSuggestOpen = ref(false);

  // Автоматический подбор оптимальных правил для любой планеты через цепные дроби
  const leapSuggestions = computed<LeapSuggestion[]>(() => {
    const orbit = targetOrbitalDays.value;
    const frac = orbit - Math.floor(orbit);
    if (frac < 0.0001 || frac > 0.9999) {
      return [];
    }

    const num = Math.round(frac * 100000);
    const den = 100000;

    // Честное математическое разложение дробной части орбиты в цепные дроби (Rust WASM ядро)
    const approximations = engine.calculateLeapConvergents(num, den, 6);

    const list: LeapSuggestion[] = approximations.map((app) => {
      const ly = Number(app.leap_years);
      const cy = Number(app.cycle_years);
      const approxFraction = ly / cy;
      const actualDrift = (approxFraction - frac) * 100;

      // Универсальный транслятор любой дроби в знаковые единичные гармоники
      const harmonics = decomposeFractionToUnitHarmonics(ly, cy);
      const meta = getSuggestionMeta(harmonics, ly, cy);

      return {
        leapYears: ly,
        cycleYears: cy,
        label: `${ly} дн. / ${cy} ${cy === 4 ? 'года' : 'лет'}`,
        driftPerCentury: actualDrift,
        description: meta.description,
        rulePreset: meta.rulePreset,
        harmonics,
      };
    });

    // Если среди подходящих дробей нет векового 400-летнего цикла, но орбита допускает его (~0.242..0.243),
    // предлагаем классический Григорианский стандарт как один из вариантов
    if (Math.abs(frac - 0.2425) < 0.003 && !list.some((s) => s.cycleYears === 400)) {
      list.push({
        leapYears: 97,
        cycleYears: 400,
        label: '97 дн. / 400 лет',
        driftPerCentury: (97 / 400 - frac) * 100,
        description: 'Григорианский стандарт: каждые 4 года (+1), кроме 100 (-1), плюс 400 (+1)',
        rulePreset: 'gregorian',
        harmonics: [
          { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
          { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
          { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
        ],
      });
      list.sort((a, b) => a.cycleYears - b.cycleYears);
    }

    return list;
  });

  const toggleSuggestions = () => {
    isSuggestOpen.value = !isSuggestOpen.value;
  };

  const applySuggestion = (s: LeapSuggestion) => {
    ensureConfig();
    if (s.rulePreset === 'gregorian') {
      ruleType.value = 'григорианское';
    } else if (s.rulePreset === 'simple_4') {
      ruleType.value = 'каждый 4 год';
    } else {
      ruleType.value = 'пользовательское';
      props.modelValue.високосные_правила = s.harmonics ? s.harmonics.map((h) => ({ ...h })) : [
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: s.cycleYears }
      ];
    }
    isSuggestOpen.value = false;
    emit?.('update:modelValue', props.modelValue);
  };

  // Предпросмотр ближайших високосов
  const sampleUpcomingYears = computed<UpcomingLeapYear[]>(() => {
    const cal = props.modelValue;
    const baseYear = cal.точка_отсчета?.год ?? 1;
    const testYears = [
      baseYear,
      baseYear + 1,
      baseYear + 2,
      baseYear + 3,
      baseYear + 4,
      baseYear + 9,
      baseYear + 10,
      baseYear + 19,
      baseYear + 20,
      baseYear + 99,
      baseYear + 100,
      baseYear + 199,
      baseYear + 200,
    ];
    // Убираем дубликаты и сортируем
    const uniqueYears = Array.from(new Set(testYears)).sort((a, b) => a - b).slice(0, 10);

    return uniqueYears.map((yr) => {
      const isLeap = engine.isLeapYear(cal, yr);
      return {
        year: yr,
        isLeap,
        daysAdded: isLeap ? leapDaysOffset.value : 0,
      };
    });
  });

  // Применение готовых пресетов
  const applyPreset = (preset: 'gregorian' | 'tolkien' | 'egyptian' | 'custom_example') => {
    ensureConfig();
    if (preset === 'gregorian') {
      ruleType.value = 'григорианское';
      targetMode.value = 'in_month';
      targetMonthIndex.value = 1; // Февраль
      leapDaysOffset.value = 1;
      baseExtraDays.value = 0;
      placement.value = 'end_of_year';
      pauseWeekdays.value = false;
      const gregorianDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (props.modelValue.месяцы && props.modelValue.месяцы.length === 12) {
        props.modelValue.месяцы.forEach((m, idx) => {
          m.дней = gregorianDays[idx];
        });
      }
    } else if (preset === 'tolkien') {
      ruleType.value = 'каждый 4 год';
      targetMode.value = 'in_extra_days';
      leapDaysOffset.value = 1;
      baseExtraDays.value = 5;
      extraDaysName.value = 'Праздники Лите (Шир)';
      placement.value = 'mid_year';
      pauseWeekdays.value = true;
      if (props.modelValue.месяцы && props.modelValue.месяцы.length === 12) {
        props.modelValue.месяцы.forEach((m) => {
          m.дней = 30;
        });
      }
    } else if (preset === 'egyptian') {
      ruleType.value = 'каждый 4 год';
      targetMode.value = 'in_extra_days';
      leapDaysOffset.value = 1;
      baseExtraDays.value = 5;
      extraDaysName.value = 'Дни рождения богов';
      placement.value = 'end_of_year';
      pauseWeekdays.value = false;
      if (props.modelValue.месяцы && props.modelValue.месяцы.length === 12) {
        props.modelValue.месяцы.forEach((m) => {
          m.дней = 30;
        });
      }
    } else if (preset === 'custom_example') {
      ruleType.value = 'пользовательское';
      targetMode.value = 'in_extra_days';
      leapDaysOffset.value = 3;
      baseExtraDays.value = 5;
      extraDaysName.value = 'Праздники обновления';
      placement.value = 'end_of_year';
      props.modelValue.високосные_правила = [
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 10 },
        { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 20 },
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 200 },
      ];
    }
    emit?.('update:modelValue', props.modelValue);
  };

  // Выравнивание месяцев под праздничные дни (например, 12 месяцев по 30 дней = 360 + праздники = 365)
  const balanceMonthsForExtraDays = () => {
    const orbit = Math.floor(targetOrbitalDays.value);
    const extra = baseExtraDays.value;
    const targetMonthsTotal = orbit - extra;
    const months = props.modelValue.месяцы;
    if (!months || months.length === 0) return;

    const count = months.length;
    if (count === 0 || targetMonthsTotal <= 0) return;
    const basePerMonth = Math.floor(targetMonthsTotal / count);
    let remainder = targetMonthsTotal % count;
    months.forEach((m) => {
      m.дней = basePerMonth + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    });
    emit?.('update:modelValue', props.modelValue);
  };

  const resetExtraDays = () => {
    baseExtraDays.value = 0;
  };

  return {
    isCollapsed,
    config,
    ruleType,
    baseExtraDays,
    extraDaysName,
    pauseWeekdays,
    placement,
    afterMonthIndex,
    yearTimeline,
    targetMode,
    targetMonthIndex,
    leapDaysOffset,
    currentHarmonics,
    totalBaseYearDays,
    driftPerCentury,
    driftWarning,
    targetOrbitalDays,
    isSuggestOpen,
    leapSuggestions,
    toggleSuggestions,
    applySuggestion,
    sampleUpcomingYears,
    addHarmonic,
    removeHarmonic,
    updateHarmonicDivisor,
    applyPreset,
    balanceMonthsForExtraDays,
    resetExtraDays,
  };
}

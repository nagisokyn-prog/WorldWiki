/**
 * @file useTab1Leap.ts
 * @description Composable для управления високосными правилами, днями вне месяцев и дрейфом орбиты через WASM.
 */

import { computed, ref } from 'vue';
import type { CalendarData, CalendarMonth, ExtraDaysConfig } from '@/services/Calendars/calendar.types';
import type {
  HarmonicRule,
  LeapRuleType,
  LeapSuggestionDto,
  SystemPresetType,
} from './Tab1Structure.model';
import {
  calculateCenturyDrift,
  calculateUpcomingYears,
  calculateYearTape,
  STANDARD_LEAP_SUGGESTIONS,
  type UpcomingYearDto,
  type YearTapeItem,
} from './tab1Leap.utils';

export function useTab1Leap(
  calendarData: () => CalendarData | null,
  planetOrbitDays: () => number | undefined,
  emit: (e: 'update', patch: Partial<CalendarData>) => void
) {
  const orbitDays = computed<number>(() => planetOrbitDays() ?? 365.2422);

  const months = computed<CalendarMonth[]>(() => calendarData()?.месяцы || []);

  const extraDaysConfig = computed<ExtraDaysConfig | undefined>(() => {
    return calendarData()?.extra_days_config;
  });

  const extraDaysCount = computed<number>(() => {
    return extraDaysConfig.value?.base_days ?? (Number(calendarData()?.extra_days) || 0);
  });

  const extraDaysName = computed<string>(() => {
    return extraDaysConfig.value?.name || 'Праздники середины года (Лите)';
  });

  const placement = computed<'end_of_year' | 'mid_year' | 'start_of_year' | 'after_month'>(() => {
    return extraDaysConfig.value?.placement || 'mid_year';
  });

  const afterMonthIndex = computed<number>(() => {
    return extraDaysConfig.value?.after_month_index || 0;
  });

  const pauseWeekdays = computed<boolean>(() => {
    return extraDaysConfig.value?.pause_weekdays ?? Boolean(calendarData()?.pause_on_holidays);
  });

  const activeSystemPreset = ref<SystemPresetType>('gregorian');

  const ruleType = computed<LeapRuleType>(() => {
    const raw = calendarData()?.правило_високосного_года;
    if (raw === 'отсутствует' || raw === 'нет') return 'none';
    if (raw === 'каждый 4 год' || raw === 'simple') return 'simple';
    if (raw === 'пользовательское' || raw === 'custom') return 'custom';
    return 'gregorian';
  });

  const leapOffset = computed<number>(() => {
    return extraDaysConfig.value?.leap_days ?? 1;
  });

  const targetMode = computed<'in_month' | 'in_extra_days'>(() => {
    return extraDaysConfig.value?.target_mode || 'in_month';
  });

  const targetMonthIndex = computed<number>(() => {
    return extraDaysConfig.value?.target_month_index ?? 1;
  });

  const targetMonthPreview = computed<string>(() => {
    const m = months.value[targetMonthIndex.value];
    const name = m?.название || `Месяц ${targetMonthIndex.value + 1}`;
    const baseDays = Number(m?.дней) || 30;
    return `${name}: ${baseDays + leapOffset.value} дн. вместо ${baseDays} дн. (+${leapOffset.value} дн.)`;
  });

  const harmonics = ref<HarmonicRule[]>([
    { weight: 1, period: 4 },
    { weight: -1, period: 100 },
    { weight: 1, period: 400 },
  ]);

  const monthsDaysSum = computed<number>(() => {
    return months.value.reduce((sum, m) => sum + (Number(m.дней) || 0), 0);
  });

  const totalNominalDays = computed<number>(() => {
    return monthsDaysSum.value + extraDaysCount.value;
  });

  const showWarningBanner = computed<boolean>(() => {
    return Math.abs(totalNominalDays.value - Math.round(orbitDays.value)) > 0.5;
  });

  const driftResult = computed(() => {
    return calculateCenturyDrift(
      monthsDaysSum.value,
      extraDaysCount.value,
      orbitDays.value,
      ruleType.value,
      harmonics.value,
      leapOffset.value
    );
  });

  const yearTape = computed<YearTapeItem[]>(() => {
    return calculateYearTape(
      months.value,
      extraDaysCount.value,
      extraDaysName.value,
      placement.value,
      afterMonthIndex.value,
      targetMode.value,
      targetMonthIndex.value,
      leapOffset.value
    );
  });
  const upcomingYears = computed<UpcomingYearDto[]>(() => {
    return calculateUpcomingYears(
      2024,
      totalNominalDays.value,
      leapOffset.value,
      ruleType.value,
      harmonics.value
    );
  });
  const suggestions = STANDARD_LEAP_SUGGESTIONS;
  function updateConfig(patch: Partial<ExtraDaysConfig>) {
    const current: ExtraDaysConfig = extraDaysConfig.value || {
      base_days: extraDaysCount.value,
      leap_days: leapOffset.value,
      pause_weekdays: pauseWeekdays.value,
      name: extraDaysName.value,
      target_mode: targetMode.value,
      target_month_index: targetMonthIndex.value,
      placement: placement.value,
      after_month_index: afterMonthIndex.value,
    };
    emit('update', { extra_days_config: { ...current, ...patch } });
  }

  function selectRuleType(type: LeapRuleType) {
    let ruleStr = 'григорианское';
    if (type === 'simple') ruleStr = 'каждый 4 год';
    else if (type === 'custom') ruleStr = 'пользовательское';
    else if (type === 'none') ruleStr = 'отсутствует';
    emit('update', { правило_високосного_года: ruleStr });
  }

  function selectSystemPreset(preset: SystemPresetType) {
    activeSystemPreset.value = preset;
    if (preset === 'gregorian') {
      selectRuleType('gregorian');
      updateConfig({ base_days: 0, target_mode: 'in_month', target_month_index: 1 });
    } else if (preset === 'tolkien') {
      selectRuleType('simple');
      updateConfig({
        base_days: 3,
        name: 'Праздники середины года (Лите)',
        placement: 'mid_year',
        target_mode: 'in_extra_days',
        pause_weekdays: true,
      });
    } else if (preset === 'egyptian') {
      selectRuleType('none');
      updateConfig({
        base_days: 5,
        name: 'Эпагомены',
        placement: 'end_of_year',
        target_mode: 'in_extra_days',
        pause_weekdays: false,
      });
    } else if (preset === 'custom') {
      selectRuleType('custom');
      harmonics.value = [
        { weight: 1, period: 10 },
        { weight: 1, period: 20 },
        { weight: 1, period: 200 },
      ];
    }
  }

  function applySuggestion(key: string) {
    if (key === 'simple') selectRuleType('simple');
    else if (key === 'gregorian') selectRuleType('gregorian');
    else if (key === 'persian') {
      selectRuleType('custom');
      harmonics.value = [{ weight: 1, period: 4 }];
    } else if (key === 'medler') {
      selectRuleType('custom');
      harmonics.value = [
        { weight: 1, period: 4 },
        { weight: -1, period: 128 },
      ];
    }
  }

  function balanceMonthsForExtraDays() {
    if (months.value.length === 0) return;
    const targetMonthTotal = Math.round(orbitDays.value) - extraDaysCount.value;
    const avg = Math.floor(targetMonthTotal / months.value.length);
    const rem = targetMonthTotal % months.value.length;
    const updated = months.value.map((m, idx) => ({
      ...m,
      дней: avg + (idx < rem ? 1 : 0),
    }));
    emit('update', { месяцы: updated });
  }

  function resetExtraDays() {
    updateConfig({ base_days: 0 });
    emit('update', { extra_days: 0 });
  }

  return {
    orbitDays,
    activeSystemPreset,
    ruleType,
    driftLabel: computed(() => driftResult.value.label),
    driftIsOk: computed(() => driftResult.value.isOk),
    showWarningBanner,
    totalNominalDays,
    monthsDaysSum,
    extraDaysCount,
    extraDaysName,
    placement,
    afterMonthIndex,
    pauseWeekdays,
    months,
    yearTape,
    leapOffset,
    targetMode,
    targetMonthIndex,
    targetMonthPreview,
    harmonics,
    upcomingYears,
    suggestions,
    selectSystemPreset,
    selectRuleType,
    applySuggestion,
    balanceMonthsForExtraDays,
    resetExtraDays,
    updateExtraDays: (val: number) => updateConfig({ base_days: val }),
    updateExtraName: (name: string) => updateConfig({ name }),
    updatePlacement: (p: any) => updateConfig({ placement: p }),
    updateAfterMonth: (idx: number) => updateConfig({ after_month_index: idx }),
    updatePauseWeekdays: (paused: boolean) => updateConfig({ pause_weekdays: paused }),
    updateLeapOffset: (val: number) => updateConfig({ leap_days: val }),
    updateTargetMode: (mode: 'in_month' | 'in_extra_days') => updateConfig({ target_mode: mode }),
    updateTargetMonth: (idx: number) => updateConfig({ target_month_index: idx }),
    updateHarmonicPeriod: (idx: number, p: number) => { harmonics.value[idx].period = p; },
    removeHarmonic: (idx: number) => { harmonics.value.splice(idx, 1); },
    addHarmonic: (w: number, p: number) => { harmonics.value.push({ weight: w, period: p }); },
  };
}

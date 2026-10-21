/**
 * @file useTab5ReformsDst.ts
 * @description Composable для управления историческими реформами календаря и DST.
 */

import { computed, ref } from 'vue';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type {
  DstPolicyConfig,
  DstPresetKey,
  DualDatingInput,
  GapReformParams,
  ReformMode,
  ReformPresetKey,
  ResetReformParams,
  Tab5ReformsDstEmits,
  Tab5ReformsDstProps,
  TransitionalReformParams,
} from './Tab5ReformsDst.model';
import {
  calculateDualDating,
  calculateNewStyleFirstDay,
  calculateVisualTape,
  DEFAULT_MONTH_NAMES,
  DEFAULT_WEEKDAY_NAMES,
  formatSliderTime,
} from './tab5ReformsDst.utils';

export function useTab5ReformsDst(props: Tab5ReformsDstProps, emit: Tab5ReformsDstEmits) {
  const mode = ref<ReformMode>('gap');
  const activePreset = ref<ReformPresetKey | null>('gregorian_1582');

  const gapParams = ref<GapReformParams>({
    oldDay: 4,
    oldMonth: 10,
    oldYear: 1582,
    droppedDays: 10,
  });

  const transParams = ref<TransitionalReformParams>({
    transitionalYear: -46,
    addedDays: 90,
  });

  const resetParams = ref<ResetReformParams>({
    resetDay: 22,
    resetMonth: 9,
    resetYearOld: 1792,
    resetToYear: 1,
  });

  const dualDatingInput = ref<DualDatingInput>({
    day: 12,
    month: 3,
    year: 1600,
  });

  const policyConfig = ref<DstPolicyConfig>({
    isEnabled: true,
    policy: 'relative',
    shiftMinutes: 60,
    springRule: { month: 3, occurrence: 'last', weekday: 6, fixedDay: 25, time: '02:00' },
    autumnRule: { month: 10, occurrence: 'last', weekday: 6, fixedDay: 25, time: '03:00' },
  });

  const shiftSelectVal = ref<string>('60');
  const dstActivePreset = ref<DstPresetKey | null>('eu_standard');

  const simTab = ref<'spring' | 'autumn'>('spring');
  const springSliderVal = ref<number>(150);
  const autumnSliderVal = ref<number>(150);
  const autumnFold = ref<number>(0);

  const monthNames = computed<string[]>(() => {
    const list = props.calendarData?.месяцы;
    if (list && list.length > 0) return list.map((m) => m.название);
    return DEFAULT_MONTH_NAMES;
  });

  const weekdayNames = computed<string[]>(() => {
    const list = props.calendarData?.названия_дней_недели;
    if (list && list.length > 0) return list;
    return DEFAULT_WEEKDAY_NAMES;
  });

  const modeBadgeText = computed<string>(() => {
    if (mode.value === 'gap') return 'Режим: Пропуск дней (DiscontinuousGap)';
    if (mode.value === 'transitional') return 'Режим: Переходный год (TransitionalYear)';
    return 'Режим: Новая Эра (EpochReset)';
  });

  const newStyleFirstDayStr = computed<string>(() => {
    return calculateNewStyleFirstDay(gapParams.value);
  });

  const visualTape = computed(() => {
    return calculateVisualTape(
      mode.value,
      gapParams.value,
      transParams.value,
      resetParams.value,
      newStyleFirstDayStr.value
    );
  });

  const dualDatingResult = computed(() => {
    return calculateDualDating(dualDatingInput.value);
  });

  const policyBadgeText = computed<string>(() => {
    if (policyConfig.value.policy === 'relative') return 'Политика: Относительные дни (EU/RUS)';
    if (policyConfig.value.policy === 'fixed') return 'Политика: Фиксированные даты';
    return 'Политика: Без перевода (None)';
  });

  const shiftBadgeText = computed<string>(() => {
    if (policyConfig.value.policy === 'none') return 'Сдвиг: 0 мин';
    return `Сдвиг: +${policyConfig.value.shiftMinutes} мин`;
  });

  const springTimeStr = computed(() => formatSliderTime(springSliderVal.value));
  const autumnTimeStr = computed(() => formatSliderTime(autumnSliderVal.value));

  const springAlertTitle = computed(() => {
    const h = Math.floor(springSliderVal.value / 60);
    if (h === 2) return 'НЕДОПУСТИМОЕ ЛОКАЛЬНОЕ ВРЕМЯ (GAP)';
    if (h >= 3) return 'ЛЕТНЕЕ ВРЕМЯ АКТИВНО';
    return 'ЗИМНЕЕ ВРЕМЯ (UTC+0)';
  });

  const springAlertDesc = computed(() => {
    const h = Math.floor(springSliderVal.value / 60);
    const m = String(springSliderVal.value % 60).padStart(2, '0');
    if (h === 2) {
      return `В эти сутки часа с 02:00 до 02:59 физически не существовало! Стрелки перескочили с 01:59 на 03:00. Система нормализует введенное писателем время в 03:${m} (UTC+1, +60 мин).`;
    }
    if (h >= 3) {
      return '✓ Летнее время активно. Смещение часового пояса: +60 минут (UTC+1). M_abs строго привязана к оси времени.';
    }
    return `Стандартное зимнее время (UTC+0). До перевода стрелок вперед осталось ${120 - springSliderVal.value} мин.`;
  });

  const springAlertStyle = computed(() => {
    const h = Math.floor(springSliderVal.value / 60);
    if (h === 2) return { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.5)' };
    if (h >= 3) return { background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)' };
    return { background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.3)' };
  });

  const springAlertTextColor = computed(() => {
    const h = Math.floor(springSliderVal.value / 60);
    return h === 2 ? 'var(--accent-danger)' : h >= 3 ? 'var(--accent-success)' : 'var(--accent-primary)';
  });

  const autumnAlertDesc = computed(() => {
    const h = Math.floor(autumnSliderVal.value / 60);
    if (h === 2) {
      if (autumnFold.value === 0) {
        return `Час ${autumnTimeStr.value} повторяется дважды! Флаг fold: 0 указывает на первое прохождение (до перевода стрелок, лето UTC+1).`;
      }
      return `Час ${autumnTimeStr.value} повторяется дважды! Флаг fold: 1 указывает на второе прохождение (после перевода назад, зима UTC+0). В хронологии разница 60 минут!`;
    }
    if (h >= 3) {
      return '✓ Стрелки уже переведены назад. Действует стандартное зимнее время (UTC+0).';
    }
    return `Действует летнее время (UTC+1). До перевода стрелок назад осталось ${180 - autumnSliderVal.value} мин.`;
  });

  const autumnAlertStyle = computed(() => {
    return { background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.4)' };
  });

  function selectReformPreset(key: ReformPresetKey) {
    activePreset.value = key;
    if (key === 'gregorian_1582') {
      mode.value = 'gap';
      gapParams.value = { oldDay: 4, oldMonth: 10, oldYear: 1582, droppedDays: 10 };
      dualDatingInput.value = { day: 12, month: 3, year: 1600 };
    } else if (key === 'caesar_46bc') {
      mode.value = 'transitional';
      transParams.value = { transitionalYear: -46, addedDays: 90 };
      dualDatingInput.value = { day: 1, month: 1, year: -45 };
    } else if (key === 'russia_1918') {
      mode.value = 'gap';
      gapParams.value = { oldDay: 31, oldMonth: 1, oldYear: 1918, droppedDays: 13 };
      dualDatingInput.value = { day: 14, month: 2, year: 1918 };
    } else if (key === 'french_1792') {
      mode.value = 'reset';
      resetParams.value = { resetDay: 22, resetMonth: 9, resetYearOld: 1792, resetToYear: 1 };
      dualDatingInput.value = { day: 14, month: 7, year: 1793 };
    } else if (key === 'fantasy_magic') {
      mode.value = 'gap';
      gapParams.value = { oldDay: 24, oldMonth: 6, oldYear: 1024, droppedDays: 7 };
      dualDatingInput.value = { day: 1, month: 1, year: 1024 };
    }
  }

  function selectDstPreset(key: DstPresetKey) {
    dstActivePreset.value = key;
    if (key === 'eu_standard') {
      policyConfig.value = {
        isEnabled: true,
        policy: 'relative',
        shiftMinutes: 60,
        springRule: { month: 3, occurrence: 'last', weekday: 6, fixedDay: 25, time: '02:00' },
        autumnRule: { month: 10, occurrence: 'last', weekday: 6, fixedDay: 25, time: '03:00' },
      };
      shiftSelectVal.value = '60';
    } else if (key === 'us_standard') {
      policyConfig.value = {
        isEnabled: true,
        policy: 'relative',
        shiftMinutes: 60,
        springRule: { month: 3, occurrence: 'second', weekday: 6, fixedDay: 10, time: '02:00' },
        autumnRule: { month: 11, occurrence: 'first', weekday: 6, fixedDay: 5, time: '02:00' },
      };
      shiftSelectVal.value = '60';
    } else if (key === 'fixed_dates') {
      policyConfig.value = {
        isEnabled: true,
        policy: 'fixed',
        shiftMinutes: 60,
        springRule: { month: 3, occurrence: 'last', weekday: 6, fixedDay: 25, time: '02:00' },
        autumnRule: { month: 10, occurrence: 'last', weekday: 6, fixedDay: 25, time: '03:00' },
      };
      shiftSelectVal.value = '60';
    } else if (key === 'fantasy_harvest') {
      policyConfig.value = {
        isEnabled: true,
        policy: 'fixed',
        shiftMinutes: 120,
        springRule: { month: 4, occurrence: 'first', weekday: 0, fixedDay: 1, time: '04:00' },
        autumnRule: { month: 7, occurrence: 'last', weekday: 0, fixedDay: 30, time: '04:00' },
      };
      shiftSelectVal.value = '120';
    } else if (key === 'none') {
      policyConfig.value.policy = 'none';
      policyConfig.value.isEnabled = false;
    }
    syncToCalendar();
  }

  function syncToCalendar() {
    emit('update', {
      dst_policy: {
        is_enabled: policyConfig.value.policy !== 'none',
        spring_shift_minutes: policyConfig.value.shiftMinutes,
        autumn_shift_minutes: -policyConfig.value.shiftMinutes,
      },
    } as unknown as Partial<CalendarData>);
  }

  function updateShiftSelect(val: string) {
    shiftSelectVal.value = val;
    if (val !== 'custom') {
      policyConfig.value.shiftMinutes = parseInt(val) || 60;
      syncToCalendar();
    }
  }

  return {
    mode,
    activePreset,
    gapParams,
    transParams,
    resetParams,
    dualDatingInput,
    policyConfig,
    shiftSelectVal,
    dstActivePreset,
    simTab,
    springSliderVal,
    autumnSliderVal,
    autumnFold,
    monthNames,
    weekdayNames,
    modeBadgeText,
    newStyleFirstDayStr,
    visualTape,
    dualDatingResult,
    policyBadgeText,
    shiftBadgeText,
    springTimeStr,
    autumnTimeStr,
    springAlertTitle,
    springAlertDesc,
    springAlertStyle,
    springAlertTextColor,
    autumnAlertDesc,
    autumnAlertStyle,
    selectReformPreset,
    selectDstPreset,
    updateShiftSelect,
    syncToCalendar,
  };
}

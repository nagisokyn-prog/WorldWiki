/**
 * @file useTab5ReformsDst.ts
 * @description Composable для управления историческими реформами календаря и DST.
 */

import { computed, ref, watch } from 'vue';
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
  DST_PRESETS,
  formatSliderTime,
  getAutumnAlertData,
  getSpringAlertData,
  REFORM_PRESETS,
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

  const springAlert = computed(() => getSpringAlertData(springSliderVal.value));
  const springAlertTitle = computed(() => springAlert.value.title);
  const springAlertDesc = computed(() => springAlert.value.desc);
  const springAlertStyle = computed(() => springAlert.value.style);
  const springAlertTextColor = computed(() => springAlert.value.textColor);

  const autumnAlert = computed(() =>
    getAutumnAlertData(autumnSliderVal.value, autumnFold.value, autumnTimeStr.value)
  );
  const autumnAlertDesc = computed(() => autumnAlert.value.desc);
  const autumnAlertStyle = computed(() => autumnAlert.value.style);

  function selectReformPreset(key: ReformPresetKey) {
    activePreset.value = key;
    const def = REFORM_PRESETS[key];
    if (!def) return;
    mode.value = def.mode;
    if (def.gapParams) gapParams.value = { ...def.gapParams };
    if (def.transParams) transParams.value = { ...def.transParams };
    if (def.resetParams) resetParams.value = { ...def.resetParams };
    dualDatingInput.value = { ...def.dualDatingInput };
  }

  function selectDstPreset(key: DstPresetKey) {
    dstActivePreset.value = key;
    const def = DST_PRESETS[key];
    if (def) {
      policyConfig.value = { ...def };
      shiftSelectVal.value = String(def.shiftMinutes);
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

  function syncFromCalendarData() {
    const cd = props.calendarData;
    if (!cd) return;

    // 1. Reform preset / params
    const rawCd = cd as Record<string, unknown>;
    const reformKey = (rawCd.reform_key as string) || (cd.reform_key as string);
    if (reformKey && ['gregorian_1582', 'caesar_46bc', 'russia_1918', 'french_1792', 'fantasy_magic'].includes(reformKey)) {
      selectReformPreset(reformKey as ReformPresetKey);
    } else if (Array.isArray(cd.reforms) && cd.reforms.length > 0) {
      const first = cd.reforms[0] as unknown as { mode?: string; gap_days?: number; start_day?: number; start_month?: number; effective_year?: number; added_days?: number };
      if (first.mode === 'gap') {
        mode.value = 'gap';
        gapParams.value = {
          oldDay: first.start_day ?? 1,
          oldMonth: first.start_month ?? 1,
          oldYear: first.effective_year ?? 1918,
          droppedDays: first.gap_days ?? 10,
        };
      } else if (first.mode === 'transitional') {
        mode.value = 'transitional';
        transParams.value = {
          transitionalYear: first.effective_year ?? -46,
          addedDays: first.added_days ?? 90,
        };
      } else if (first.mode === 'reset') {
        mode.value = 'reset';
        resetParams.value = {
          resetDay: first.start_day ?? 1,
          resetMonth: first.start_month ?? 1,
          resetYearOld: first.effective_year ?? 1792,
          resetToYear: 1,
        };
      }
    }

    // 2. DST policy preset
    const dstPreset = (rawCd.dst_preset as string) || (cd.dst_preset as string);
    if (dstPreset && ['eu_standard', 'us_standard', 'fixed_dates', 'fantasy_harvest', 'none'].includes(dstPreset)) {
      selectDstPreset(dstPreset as DstPresetKey);
    } else {
      const rawPolicy = rawCd.dst_policy as { is_enabled?: boolean; spring_shift_minutes?: number } | undefined;
      if (rawPolicy && typeof rawPolicy === 'object') {
        if (rawPolicy.is_enabled === false) {
          selectDstPreset('none');
        } else {
          policyConfig.value.isEnabled = true;
          policyConfig.value.policy = 'relative';
          policyConfig.value.shiftMinutes = rawPolicy.spring_shift_minutes || 60;
          shiftSelectVal.value = String(policyConfig.value.shiftMinutes);
        }
      }
    }
  }

  watch(() => props.calendarData, syncFromCalendarData, { immediate: true });

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

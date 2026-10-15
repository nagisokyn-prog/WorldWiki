import { ref, onMounted, computed } from 'vue';
import { settingsService } from '@worldwiki/components';
import type { AppSettings } from '@worldwiki/components';
import type { CalendarLeapYearProps } from './CalendarLeapYear.model';
import { useCalendarEngine } from '../../../../services/Calendars/useCalendarEngine';
import { CalendarCycles } from '../../../../services/Calendars/calendar.cycles';
import type { CalendarData } from '../../../../services/Calendars/calendar.types';

export function useCalendarLeapYear(props: CalendarLeapYearProps, _emit?: (event: string, ...args: unknown[]) => void) {
  const isCollapsed = ref(false);
  const engine = useCalendarEngine();

  const wheelHorizontal = ref(
    settingsService.getSettings()?.dropdowns?.wheelOrientation === 'horizontal',
  );

  onMounted(() => {
    settingsService.onChange(
      (s: AppSettings) => (wheelHorizontal.value = s.dropdowns?.wheelOrientation === 'horizontal'),
    );
    if (!props.modelValue.пользовательское_високосное_правило) {
      props.modelValue.пользовательское_високосное_правило = { месяц: 0, день_смещения: 1 };
    }
  });

  const updateRule = (val: string) => {
    props.modelValue.правило_високосного_года = val;
  };

  const customRuleMonth = computed({
    get: () => props.modelValue.пользовательское_високосное_правило?.месяц || 0,
    set: (val: number) => {
      if (!props.modelValue.пользовательское_високосное_правило) {
        props.modelValue.пользовательское_високосное_правило = { месяц: val, день_смещения: 1 };
      } else {
        props.modelValue.пользовательское_високосное_правило.месяц = val;
      }
    },
  });

  const customRuleDays = computed({
    get: () => props.modelValue.пользовательское_високосное_правило?.день_смещения || 1,
    set: (val: number) => {
      if (!props.modelValue.пользовательское_високосное_правило) {
        props.modelValue.пользовательское_високосное_правило = { месяц: 0, день_смещения: val };
      } else {
        props.modelValue.пользовательское_високосное_правило.день_смещения = val;
      }
    },
  });

  // Расчет векового дрейфа
  const driftPerCentury = computed(() => {
    const cal = props.modelValue as CalendarData;
    const baseDays = CalendarCycles.getBaseDaysInYear(cal);
    const harmonics = CalendarCycles.getHarmonics(cal);
    const targetLength = props.modelValue.target_year_length_days || 365.24219;
    return engine.calculateDriftPerCentury(baseDays, harmonics, targetLength);
  });

  // Предупреждение о вековом расхождении
  const driftWarning = computed(() => {
    const drift = driftPerCentury.value;
    if (Math.abs(drift) > 1.0) {
      const sign = drift > 0 ? '+' : '';
      return `Вековое расхождение: ${sign}${drift.toFixed(2)} суток за 100 лет. Рекомендуется скорректировать гармоники.`;
    }
    return null;
  });

  return {
    isCollapsed,
    wheelHorizontal,
    updateRule,
    customRuleMonth,
    customRuleDays,
    driftPerCentury,
    driftWarning,
  };
}

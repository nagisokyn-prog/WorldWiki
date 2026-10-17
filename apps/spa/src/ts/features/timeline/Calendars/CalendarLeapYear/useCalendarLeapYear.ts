import { ref, onMounted, computed } from 'vue';
import { settingsService } from '@worldwiki/components';
import type { AppSettings } from '@worldwiki/components';
import type { CalendarLeapYearProps } from './CalendarLeapYear.model';
import { useCalendarEngine } from '../../../../services/Calendars/useCalendarEngine';
import type { CalendarData, LeapHarmonic } from '../../../../services/Calendars/calendar.types';

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

  const currentHarmonics = computed<LeapHarmonic[]>(() => {
    const rule = props.modelValue.правило_високосного_года;
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
    return [];
  });

  // Расчет векового дрейфа
  const driftPerCentury = computed(() => {
    const cal = props.modelValue as CalendarData;
    const baseDays = cal.месяцы?.reduce((acc, m) => acc + (m.дней || 0), 0) || 365;
    const targetLength = (props.modelValue as any).target_year_length_days || 365.24219;
    return engine.calculateDriftPerCentury(baseDays, currentHarmonics.value, targetLength);
  });

  // Пресеты цепных дробей
  const convergents = computed(() => {
    const targetLength = (props.modelValue as any).target_year_length_days || 365.24219;
    const frac = targetLength - Math.floor(targetLength);
    const num = Math.round(frac * 100000);
    return engine.calculateLeapConvergents(num, 100000, 5);
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
    convergents,
  };
}

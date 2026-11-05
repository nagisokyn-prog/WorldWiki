/**
 * @file useCalendarAuditModal.ts
 * @description Бизнес-логика модального окна диагностики и комплексного аудита календаря в 1 клик.
 */

import { computed, ref } from 'vue';
import { useCalendarEngine } from '@/services/Calendars/useCalendarEngine';
import type { CalendarAuditModalProps, CalendarAuditModalEmits } from './CalendarAuditModal.model';
import type { CalendarAuditReport, WasmCultureConfig, YearPreview } from '@worldwiki/calendar-wasm';

export function useCalendarAuditModal(
  props: CalendarAuditModalProps,
  emit: CalendarAuditModalEmits
) {
  const engine = useCalendarEngine();
  const previewYear = ref(1);

  const isOpen = computed({
    get: () => props.modelValue,
    set: (val: boolean) => emit('update:modelValue', val),
  });

  const close = () => {
    isOpen.value = false;
  };

  const cultureConfig = computed<WasmCultureConfig>(() => {
    const cal = props.calendar;
    return {
      planet_id: cal._id || 'world',
      ticks_per_day:
        (cal.настройки_времени?.часов_в_сутках || 24) *
        (cal.настройки_времени?.минут_в_часе || 60) *
        60,
      day_start_offset: 0,
      base_year_days: cal.месяцы?.reduce((a, m) => a + (m.дней || 0), 0) || 365,
      regular_months: cal.месяцы?.map((m) => m.дней || 30) || [30],
      harmonics: [
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 4 },
        { weight: -1, multiplier_a: 1, shift_b: 0, divisor_c: 100 },
        { weight: 1, multiplier_a: 1, shift_b: 0, divisor_c: 400 },
      ],
      leap_target: {
        InMonth: { target_month: cal.пользовательское_високосное_правило?.месяц ?? 1 },
      },
      leap_day_offset: cal.пользовательское_високосное_правило?.день_смещения ?? 1,
      calendar_origin_day: 0,
      dial: {
        units: [
          { name: 'Hour', subdivisions: cal.настройки_времени?.часов_в_сутках || 24 },
          { name: 'Minute', subdivisions: cal.настройки_времени?.минут_в_часе || 60 },
        ],
      },
      eras: (cal.эпохи || []).map((e) => ({
        name: e.название || 'Era',
        start_year: e.год_начала ?? 1,
        is_count_down: e.обратный_отсчет ?? false,
        counting_mode: 'by_calendar_year' as const,
      })),
    };
  });

  const auditReport = computed<CalendarAuditReport>(() => {
    const tropYearNum = 3652422;
    const tropYearDen = 10000;
    return engine.auditCalendarCulture(cultureConfig.value, tropYearNum, tropYearDen);
  });

  const yearPreview = computed<YearPreview>(() => {
    return engine.generateYearPreview(
      previewYear.value,
      cultureConfig.value,
      props.calendar.первый_месяц_года || 0
    );
  });

  return {
    isOpen,
    close,
    previewYear,
    auditReport,
    yearPreview,
  };
}

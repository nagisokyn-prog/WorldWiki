import { describe, it, expect, vi } from 'vitest';
import { useCalendarAuditModal } from '../useCalendarAuditModal';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';

describe('useCalendarAuditModal', () => {
  const defaultCal = CalendarMath.getDefaultCalendar();

  it('initializes with audit report and preview', () => {
    const emit = vi.fn();
    const hook = useCalendarAuditModal(
      {
        modelValue: true,
        calendar: defaultCal,
      },
      emit
    );

    expect(hook.isOpen.value).toBe(true);
    expect(hook.auditReport.value.is_valid).toBe(true);
    expect(hook.yearPreview.value.months.length).toBe(12);

    hook.close();
    expect(emit).toHaveBeenCalledWith('update:modelValue', false);
  });

  it('handles sparse calendar fallbacks for time settings, months, leap rule, and eras', () => {
    const emit = vi.fn();
    const sparseCal = {
      ...defaultCal,
      _id: '',
      настройки_времени: undefined,
      месяцы: [{ название: 'M1', дней: 0 }],
      пользовательское_високосное_правило: undefined,
      эпохи: [{ название: '', год_начала: undefined, обратный_отсчет: undefined }],
      первый_месяц_года: undefined,
    } as any;

    const hook = useCalendarAuditModal(
      { modelValue: false, calendar: sparseCal },
      emit
    );

    expect(hook.isOpen.value).toBe(false);
    expect(hook.auditReport.value).toBeDefined();
    expect(hook.yearPreview.value).toBeDefined();
  });
});

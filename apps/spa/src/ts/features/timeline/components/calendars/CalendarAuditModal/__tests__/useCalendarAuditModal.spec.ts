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
});

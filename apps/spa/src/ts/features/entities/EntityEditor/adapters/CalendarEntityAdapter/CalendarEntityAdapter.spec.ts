import { describe, it, expect, vi } from 'vitest';
import { useCalendarEntityAdapter } from './useCalendarEntityAdapter';
import type { CalendarRecord } from '@/stores/calendar.store';

describe('useCalendarEntityAdapter', () => {
  const dummyProps = {
    calendarId: 'cal_123',
    projectId: 'test_project',
    isPreview: false,
  };

  it('initializes with null calendar record', () => {
    const emit = vi.fn();
    const { currentCalendarRecord } = useCalendarEntityAdapter(dummyProps, emit);
    expect(currentCalendarRecord.value).toBeNull();
  });

  it('handles calendar updates and emits update:modelValue and modified', () => {
    const emit = vi.fn();
    const { currentCalendarRecord, onCalendarUpdate } = useCalendarEntityAdapter(
      dummyProps,
      emit
    );

    const testCalendar: CalendarRecord = {
      id: 'cal_123',
      name: 'Григорианский',
      is_master: true,
      is_default: true,
      data: {
        название: 'Григорианский',
        часов_в_дне: 24,
      } as any,
    };

    onCalendarUpdate(testCalendar);

    expect(currentCalendarRecord.value).toEqual(testCalendar);
    expect(emit).toHaveBeenCalledWith(
      'update:modelValue',
      expect.objectContaining({
        id: 'cal_123',
        name: 'Григорианский',
        is_master: true,
        is_default: true,
        часов_в_дне: 24,
      })
    );
    expect(emit).toHaveBeenCalledWith('modified');
  });

  it('handles calendar save and emits save event', () => {
    const emit = vi.fn();
    const { currentCalendarRecord, onCalendarSave } = useCalendarEntityAdapter(
      dummyProps,
      emit
    );

    const testCalendar: CalendarRecord = {
      id: 'cal_123',
      name: 'Солнечный',
      is_master: false,
      is_default: false,
      data: {} as any,
    };

    onCalendarSave(testCalendar);

    expect(currentCalendarRecord.value).toEqual(testCalendar);
    expect(emit).toHaveBeenCalledWith('save', testCalendar);
  });
});

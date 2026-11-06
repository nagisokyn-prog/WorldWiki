import { describe, it, expect, vi } from 'vitest';
import { usePromiseCardDateTimeWheels } from './usePromiseCardDateTimeWheels';
import type { PromiseCardDateTimeWheelsProps } from './PromiseCardDateTimeWheels.model';

describe('usePromiseCardDateTimeWheels', () => {
  const baseProps: PromiseCardDateTimeWheelsProps = {
    currentEraIdx: 0,
    currentYear: 2026,
    currentMonthIdx: 0,
    currentDay: 1,
    currentHour: 12,
    currentMinute: 30,
    eraWheelOptions: [{ value: 0, label: 'Новая Эра' }],
    yearWheelOptions: [{ value: 2026, label: '2026' }],
    monthWheelOptions: [{ value: 0, label: 'Январь' }],
    dayWheelOptions: [{ value: 1, label: '1' }],
    hourWheelOptions: [{ value: 12, label: '12' }],
    minuteWheelOptions: [{ value: 30, label: '30' }],
    eraMinYear: 2000,
    eraMaxYear: 2100
  };

  it('clamps year input between eraMinYear and eraMaxYear', () => {
    const emit = vi.fn();
    const wheels = usePromiseCardDateTimeWheels(baseProps, emit);

    wheels.handleYearInput('2050');
    expect(emit).toHaveBeenCalledWith('update:currentYear', 2050);
    expect(emit).toHaveBeenCalledWith('change');

    // Below min
    wheels.handleYearInput('1500');
    expect(emit).toHaveBeenCalledWith('update:currentYear', 2000);

    // Above max
    wheels.handleYearInput('2500');
    expect(emit).toHaveBeenCalledWith('update:currentYear', 2100);

    // Invalid NaN
    wheels.handleYearInput('abc');
    expect(emit).toHaveBeenCalledWith('update:currentYear', 2000);
  });

  it('emits updates for month, day, hour, minute', () => {
    const emit = vi.fn();
    const wheels = usePromiseCardDateTimeWheels(baseProps, emit);

    wheels.onMonthChange(2);
    expect(emit).toHaveBeenCalledWith('update:currentMonthIdx', 2);
    expect(emit).toHaveBeenCalledWith('change');

    wheels.onDayChange(15);
    expect(emit).toHaveBeenCalledWith('update:currentDay', 15);
    expect(emit).toHaveBeenCalledWith('change');

    wheels.onHourChange(18);
    expect(emit).toHaveBeenCalledWith('update:currentHour', 18);
    expect(emit).toHaveBeenCalledWith('change');

    wheels.onMinuteChange(45);
    expect(emit).toHaveBeenCalledWith('update:currentMinute', 45);
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('emits onEraChange', () => {
    const emit = vi.fn();
    const wheels = usePromiseCardDateTimeWheels(baseProps, emit);

    wheels.onEraChange(1);
    expect(emit).toHaveBeenCalledWith('update:currentEraIdx', 1);
    expect(emit).toHaveBeenCalledWith('change');
  });
});


import type { PromiseCardDateTimeWheelsProps, PromiseCardDateTimeWheelsEmits } from './PromiseCardDateTimeWheels.model';

export function usePromiseCardDateTimeWheels(
  props: PromiseCardDateTimeWheelsProps,
  emit: PromiseCardDateTimeWheelsEmits
) {
  const handleYearInput = (rawVal: string | number) => {
    const num = Number(rawVal);
    const min = props.eraMinYear ?? 1;
    const max = props.eraMaxYear ?? Infinity;
    if (isNaN(num)) {
      emit('update:currentYear', min);
      emit('change');
      return;
    }
    const clamped = Math.min(max, Math.max(min, num));
    emit('update:currentYear', clamped);
    emit('change');
  };

  const onEraChange = (val: number | string) => {
    emit('update:currentEraIdx', Number(val) || 0);
    emit('change');
  };

  const onYearChange = (val: number | string) => {
    handleYearInput(val);
  };

  const onMonthChange = (val: number | string) => {
    emit('update:currentMonthIdx', Number(val) || 0);
    emit('change');
  };

  const onDayChange = (val: number | string) => {
    emit('update:currentDay', Number(val) || 1);
    emit('change');
  };

  const onHourChange = (val: number | string) => {
    emit('update:currentHour', Number(val) || 0);
    emit('change');
  };

  const onMinuteChange = (val: number | string) => {
    emit('update:currentMinute', Number(val) || 0);
    emit('change');
  };

  return {
    handleYearInput,
    onEraChange,
    onYearChange,
    onMonthChange,
    onDayChange,
    onHourChange,
    onMinuteChange
  };
}


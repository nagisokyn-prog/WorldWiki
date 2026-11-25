import { computed, reactive, ref } from 'vue';
import type { TimeJumpPopoverProps, TimeJumpPopoverEmits } from './TimeJumpPopover.model';
import { formatTimeJumpLabel, type TimeJumpPreset } from '../timeJumpPresets';

export function useTimeJumpPopover(
  props: TimeJumpPopoverProps,
  emit: TimeJumpPopoverEmits
) {
  const sign = ref<1 | -1>(1);
  const years = ref<number>(0);
  const months = ref<number>(0);
  const days = ref<number>(0);
  const customLabel = ref<string>('');
  const dialValues = reactive<Record<string, number>>({});

  /** Единицы циферблата без 'д' (дни вынесены отдельно рядом с годами и месяцами). */
  const subDayUnits = computed(() =>
    (props.dialDeltaChips || [])
      .map((chip) => ({
        key: chip.label.replace(/^\+1/, ''),
        title: chip.title.replace(/^\+1\s*/, ''),
        deltaMinutes: chip.deltaMinutes
      }))
      .filter((u) => u.key && u.key !== 'д')
      .reverse()
  );

  const buildDraft = (): Omit<TimeJumpPreset, 'id'> => {
    const cleanDial: Record<string, number> = {};
    for (const u of subDayUnits.value) {
      const val = Math.max(0, Math.floor(Number(dialValues[u.key]) || 0));
      if (val > 0) cleanDial[u.key] = val;
    }
    return {
      sign: sign.value,
      years: Math.max(0, Math.floor(Number(years.value) || 0)),
      months: Math.max(0, Math.floor(Number(months.value) || 0)),
      days: Math.max(0, Math.floor(Number(days.value) || 0)),
      dialUnits: cleanDial,
      label: customLabel.value.trim() || undefined
    };
  };

  const hasAnyValue = computed(() => {
    const d = buildDraft();
    return Boolean(
      (d.years && d.years > 0) ||
      (d.months && d.months > 0) ||
      (d.days && d.days > 0) ||
      (d.dialUnits && Object.keys(d.dialUnits).length > 0)
    );
  });

  const previewLabel = computed(() => formatTimeJumpLabel(buildDraft(), props.dialDeltaChips));

  const setDialValue = (key: string, raw: string) => {
    dialValues[key] = Math.max(0, Math.floor(Number(raw) || 0));
  };

  const applyOnce = () => {
    if (!hasAnyValue.value) return;
    emit('apply', buildDraft());
    emit('close');
  };

  const saveAndApply = () => {
    if (!hasAnyValue.value) return;
    emit('save-and-apply', buildDraft());
    emit('close');
  };

  return {
    sign,
    years,
    months,
    days,
    customLabel,
    dialValues,
    subDayUnits,
    hasAnyValue,
    previewLabel,
    setDialValue,
    applyOnce,
    saveAndApply
  };
}

import { computed } from 'vue';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type {
  CalendarReform,
  DstPolicy,
  ReformMode,
  Tab5ReformsDstProps,
  Tab5ReformsDstEmits,
} from './Tab5ReformsDst.model';

export function useTab5ReformsDst(
  props: Tab5ReformsDstProps,
  emit: Tab5ReformsDstEmits
) {
  const reforms = computed<CalendarReform[]>(() => {
    const data = props.calendarData as unknown as { reforms?: CalendarReform[] };
    return data?.reforms || [];
  });

  const dstPolicy = computed<DstPolicy>(() => {
    const data = props.calendarData as unknown as { dst_policy?: DstPolicy };
    return (
      data?.dst_policy || {
        is_enabled: false,
        spring_shift_minutes: 60,
        autumn_shift_minutes: -60,
      }
    );
  });

  function updateReforms(newReforms: CalendarReform[]) {
    emit('update', { reforms: newReforms } as unknown as Partial<CalendarData>);
  }

  function updateDstPolicy(patch: Partial<DstPolicy>) {
    emit('update', {
      dst_policy: {
        ...dstPolicy.value,
        ...patch,
      },
    } as unknown as Partial<CalendarData>);
  }

  function addReform(mode: ReformMode = 'DiscontinuousGap') {
    const nextIdx = reforms.value.length + 1;
    const newReform: CalendarReform = {
      name: `Календарная Реформа ${nextIdx}`,
      effective_year: 1582,
      mode,
      skipped_days: mode === 'DiscontinuousGap' ? 10 : undefined,
      description: 'Коррекция расхождения с солнечным равноденствием',
    };
    updateReforms([...reforms.value, newReform]);
  }

  function removeReform(idx: number) {
    updateReforms(reforms.value.filter((_, i) => i !== idx));
  }

  function toggleDst(enabled: boolean) {
    updateDstPolicy({ is_enabled: enabled });
  }

  return {
    reforms,
    dstPolicy,
    updateReforms,
    updateDstPolicy,
    addReform,
    removeReform,
    toggleDst,
  };
}

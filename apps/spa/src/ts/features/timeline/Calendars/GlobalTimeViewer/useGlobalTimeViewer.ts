import { ref, watch, onMounted, onUnmounted } from 'vue';
import { invoke } from '@worldwiki/components';
import { useCalendarStore } from '../../../../stores/calendar.store';
import { useShellStore } from '../../../../stores/shell';

import type { CalendarRecord } from '../../../../stores/calendar.store';

export interface LocalDateItem {
  id?: string;
  name?: string;
  date: Record<string, unknown>;
}

export function useGlobalTimeViewer() {
  const isVisible = ref(false);
  const minute = ref(0);
  const calendars = ref<CalendarRecord[]>([]);
  const localDates = ref<LocalDateItem[]>([]);
  const loading = ref(false);

  const shellStore = useShellStore();

  const open = () => { isVisible.value = true; };
  const close = () => { isVisible.value = false; };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
      e.preventDefault();
      isVisible.value = !isVisible.value;
    }
  };

  const loadCalendars = async () => {
    loading.value = true;
    calendars.value = await useCalendarStore().getCalendars(shellStore.projectName!);
    loading.value = false;
    await updateLocalDates();
  };

  const updateLocalDates = async () => {
    if (calendars.value.length === 0) return;
    const results: LocalDateItem[] = [];
    for (const cal of calendars.value) {
      const data = cal.data || cal;
      const date = await invoke<Record<string, unknown>>('convert_absolute_to_local', {
        absoluteMinute: minute.value,
        calendar: data,
        eraIndex: 0
      });
      results.push({ id: cal.id, name: cal.name, date });
    }
    localDates.value = results;
  };

  onMounted(async () => {
    window.addEventListener('keydown', handleKeydown);
    if (shellStore.projectName) {
      await loadCalendars();
    }
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  watch(minute, () => {
    updateLocalDates();
  });

  watch(() => shellStore.projectName, async (newVal) => {
    if (newVal && isVisible.value) {
      await loadCalendars();
    }
  });

  return {
    isVisible,
    minute,
    localDates,
    loading,
    open,
    close
  };
}

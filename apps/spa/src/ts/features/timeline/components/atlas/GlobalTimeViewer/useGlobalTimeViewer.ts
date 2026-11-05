import { ref, watch, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import type { Ref } from 'vue';
import { invoke } from '@worldwiki/components';
import { useCalendarStore } from '@/stores/calendar.store';

import type { CalendarRecord } from '@/stores/calendar.store';

export interface LocalDateItem {
  id?: string;
  name?: string;
  date: Record<string, unknown>;
}

export function useGlobalTimeViewer(projectNameInput?: string | Ref<string | undefined> | (() => string | undefined)) {
  const isVisible = ref(false);
  const minute = ref(0);
  const calendars = ref<CalendarRecord[]>([]);
  const localDates = ref<LocalDateItem[]>([]);
  const loading = ref(false);

  const getProjectName = (): string | undefined => {
    if (typeof projectNameInput === 'function') return projectNameInput();
    if (projectNameInput && typeof projectNameInput === 'object' && 'value' in projectNameInput) return projectNameInput.value;
    return typeof projectNameInput === 'string' ? projectNameInput : undefined;
  };

  const open = () => { isVisible.value = true; };
  const close = () => { isVisible.value = false; };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
      e.preventDefault();
      isVisible.value = !isVisible.value;
    }
  };

  const loadCalendars = async () => {
    const proj = getProjectName();
    if (!proj) return;
    loading.value = true;
    calendars.value = await useCalendarStore().getCalendars(proj);
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

  const toggle = () => { isVisible.value = !isVisible.value; };

  if (getCurrentInstance()) {
    onMounted(async () => {
      window.addEventListener('keydown', handleKeydown);
      window.addEventListener('ww:toggle-global-time', toggle);
      window.addEventListener('ww:open-global-time', open);
      if (getProjectName()) {
        await loadCalendars();
      }
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('ww:toggle-global-time', toggle);
      window.removeEventListener('ww:open-global-time', open);
    });
  }

  watch(minute, () => {
    updateLocalDates();
  });

  watch(() => getProjectName(), async (newVal) => {
    if (newVal && isVisible.value) {
      await loadCalendars();
    }
  });

  const stepMinute = (delta: number) => {
    minute.value += delta;
  };

  const setMinute = (val: number) => {
    if (!Number.isNaN(val)) {
      minute.value = val;
    }
  };

  const handlePrevMinute = () => {
    stepMinute(-1000);
  };

  const handleNextMinute = () => {
    stepMinute(1000);
  };

  const handleMinuteInput = (event: Event) => {
    const val = (event.target as HTMLInputElement).valueAsNumber;
    setMinute(val);
  };

  return {
    isVisible,
    minute,
    localDates,
    loading,
    open,
    close,
    stepMinute,
    setMinute,
    handlePrevMinute,
    handleNextMinute,
    handleMinuteInput
  };
}

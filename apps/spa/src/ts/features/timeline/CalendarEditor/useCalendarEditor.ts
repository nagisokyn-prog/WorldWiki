import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useCalendarStore, type CalendarRecord } from '@/stores/calendar.store';
import { CalendarEngine } from '@/services/Calendars/useCalendarEngine';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type { CalendarPreset } from '../Calendars/presets';
import type {
  CalendarEditorProps,
  CalendarEditorTab,
  CalendarTabInfo,
  CalendarEditorEmits,
} from './CalendarEditor.model';
import {
  getCalendarStateKey,
  getCalendarScrollKey,
  saveCalendarLocalDraft,
  loadCalendarLocalDraft,
  clearCalendarLocalDraft,
} from './useCalendarEditorStorage';

export function useCalendarEditor(
  props: CalendarEditorProps,
  emit: CalendarEditorEmits
) {
  const calendarStore = useCalendarStore();

  const activeTab = ref<CalendarEditorTab>('timeGrid');
  const calendarRecord = ref<CalendarRecord | null>(null);
  const masterCalendarRecord = ref<CalendarRecord | null>(null);
  const isLoading = ref<boolean>(false);
  const isSaving = ref<boolean>(false);
  const error = ref<string | null>(null);
  const isAuditModalOpen = ref<boolean>(false);
  const isPresetsModalOpen = ref<boolean>(false);
  const hasUnsavedDraft = ref<boolean>(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const getStateKey = () => getCalendarStateKey(props.projectId, props.calendarId);
  const getScrollKey = () => getCalendarScrollKey(props.projectId, props.calendarId);

  const calData = computed<CalendarData | null>(() => (calendarRecord.value?.data as CalendarData) || null);
  const masterCalData = computed<CalendarData | null>(() => (masterCalendarRecord.value?.data as CalendarData) || null);

  const totalDays = computed<number>(() => {
    if (!calData.value) return 365;
    const monthsDays = (calData.value.месяцы || []).reduce((sum, m) => sum + (Number(m.дней) || 0), 0);
    return monthsDays + (Number(calData.value.extra_days) || 0);
  });

  const planetOrbitDays = computed<number>(() => {
    return Number((calData.value as Record<string, unknown>)?.planet_orbit_days) || 365.2422;
  });

  const tabsList = computed<CalendarTabInfo[]>(() => [
    { id: 'timeGrid', label: 'Структура года', icon: '⏰', badge: `${totalDays.value} дн` },
    { id: 'erasSync', label: 'Летоисчисление и эры', icon: '🏛️', badge: calData.value?.эпохи ? `${calData.value.эпохи.length} эр` : undefined },
    { id: 'cultureLore', label: 'Традиции и культура', icon: '🎭', badge: calData.value?.праздники ? `${calData.value.праздники.length} праздн.` : undefined },
    { id: 'playground', label: 'Калькулятор дат сюжета', icon: '🧪', badge: 'Сюжет' },
    { id: 'reformsDst', label: 'Реформы и перевод часов', icon: '🔄', badge: 'Стиль' },
  ]);

  function scheduleStateSave() {
    if (isLoading.value) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      saveCalendarLocalDraft(getStateKey(), {
        activeTab: activeTab.value,
        unsavedData: hasUnsavedDraft.value ? (calendarRecord.value?.data as Record<string, unknown>) : undefined,
        unsavedName: hasUnsavedDraft.value ? calendarRecord.value?.name : undefined,
      });
    }, 250);
  }

  function hydrateFromStorage() {
    const saved = loadCalendarLocalDraft(getStateKey());
    if (!saved) return;
    if (saved.activeTab && tabsList.value.some((t) => t.id === saved.activeTab)) {
      activeTab.value = saved.activeTab as CalendarEditorTab;
    }
    if (saved.unsavedData && calendarRecord.value) {
      calendarRecord.value.data = saved.unsavedData as unknown as CalendarData;
      if (saved.unsavedName) calendarRecord.value.name = saved.unsavedName;
      hasUnsavedDraft.value = true;
      emit('update:calendar', calendarRecord.value.data as Record<string, unknown>);
    }
  }

  async function loadCalendar() {
    isLoading.value = true;
    error.value = null;
    try {
      const list = await calendarStore.getCalendars(props.projectId);
      const found = list.find((c) => c.id === props.calendarId) || list[0] || null;
      masterCalendarRecord.value = list.find((c) => c.is_master) || null;

      if (found) {
        calendarRecord.value = JSON.parse(JSON.stringify(found));
        if (!calendarRecord.value?.data) calendarRecord.value!.data = CalendarEngine.getDefaultCalendar();
      } else {
        const defaultData = CalendarEngine.getDefaultCalendar();
        calendarRecord.value = {
          id: props.calendarId || 'cal_new',
          name: defaultData.название || 'Новый календарь',
          is_default: false,
          is_master: false,
          data: defaultData,
        };
      }
      hydrateFromStorage();
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить календарь';
      console.error('[CalendarEditor] Ошибка загрузки:', e);
    } finally {
      isLoading.value = false;
    }
  }

  function patchCalendarData(patch: Partial<CalendarData>) {
    if (!calendarRecord.value) return;
    calendarRecord.value.data = { ...(calendarRecord.value.data || {}), ...patch } as CalendarData & Record<string, unknown>;
    if (patch.название) calendarRecord.value.name = patch.название;
    if (patch.is_master !== undefined) calendarRecord.value.is_master = patch.is_master;
    hasUnsavedDraft.value = true;
    scheduleStateSave();
    emit('update:calendar', calendarRecord.value.data as Record<string, unknown>);
  }

  function updateName(name: string) {
    if (!calendarRecord.value) {
      const defaultData = CalendarEngine.getDefaultCalendar();
      calendarRecord.value = { id: props.calendarId || 'cal_new', name, is_default: false, is_master: false, data: { ...defaultData, название: name } };
    } else {
      calendarRecord.value.name = name;
      if (calendarRecord.value.data) calendarRecord.value.data.название = name;
    }
    hasUnsavedDraft.value = true;
    scheduleStateSave();
    emit('update:name', name);
    document.dispatchEvent(new CustomEvent('ww:calendar-renamed', { detail: { id: calendarRecord.value.id || props.calendarId, name } }));
    emit('update:calendar', calendarRecord.value.data as Record<string, unknown>);
  }

  async function saveCalendar() {
    if (!calendarRecord.value) return;
    isSaving.value = true;
    error.value = null;
    try {
      const dataToSave = {
        ...(calendarRecord.value.data || {}),
        id: calendarRecord.value.id,
        _id: calendarRecord.value.id,
        name: calendarRecord.value.name || calendarRecord.value.data?.название || 'Календарь',
        название: calendarRecord.value.name || calendarRecord.value.data?.название || 'Календарь',
        is_default: calendarRecord.value.is_default,
        is_master: calendarRecord.value.is_master,
      } as unknown as CalendarData & Record<string, unknown>;

      await calendarStore.saveCalendar(props.projectId, dataToSave);
      hasUnsavedDraft.value = false;
      saveCalendarLocalDraft(getStateKey(), { activeTab: activeTab.value });
      emit('save', calendarRecord.value.data as Record<string, unknown>);
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Не удалось сохранить календарь';
      console.error('[CalendarEditor] Ошибка сохранения:', e);
    } finally {
      isSaving.value = false;
    }
  }

  async function deleteCalendar() {
    if (!calendarRecord.value?.id) return;
    if (!confirm('Вы уверены, что хотите удалить этот календарь?')) return;
    try {
      const calId = calendarRecord.value.id;
      await calendarStore.deleteCalendar(calId);
      clearCalendarLocalDraft(getStateKey(), getScrollKey());
      document.dispatchEvent(new CustomEvent('ww:calendar-deleted', { detail: { id: calId } }));
      emit('delete', calId);
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Не удалось удалить календарь';
      console.error('[CalendarEditor] Ошибка удаления:', e);
    }
  }

  function setTab(tab: CalendarEditorTab) {
    activeTab.value = tab;
    scheduleStateSave();
  }

  function openAuditModal() { isAuditModalOpen.value = true; }
  function openPresetsModal() { isPresetsModalOpen.value = true; }

  function applyPreset(preset: CalendarPreset) {
    if (!calendarRecord.value) return;
    const patchedData = { ...(calendarRecord.value.data || {}), ...preset.data } as CalendarData;
    calendarRecord.value.data = patchedData;
    if (preset.data.название) {
      calendarRecord.value.name = preset.data.название;
      emit('update:name', preset.data.название);
      document.dispatchEvent(new CustomEvent('ww:calendar-renamed', { detail: { id: calendarRecord.value.id || props.calendarId, name: preset.data.название } }));
    }
    hasUnsavedDraft.value = true;
    scheduleStateSave();
    emit('update:calendar', patchedData as unknown as Record<string, unknown>);
  }

  const handleRenamed = (e: Event) => {
    const { id, name } = (e as CustomEvent<{ id: string; name: string }>).detail;
    if (calendarRecord.value && (calendarRecord.value.id === id || String(calendarRecord.value.id).endsWith(id) || props.calendarId === id)) {
      if (calendarRecord.value.name !== name) {
        calendarRecord.value.name = name;
        if (calendarRecord.value.data) calendarRecord.value.data.название = name;
      }
    }
  };

  onMounted(async () => {
    document.addEventListener('ww:calendar-renamed', handleRenamed as EventListener);
    await loadCalendar();
  });

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    document.removeEventListener('ww:calendar-renamed', handleRenamed as EventListener);
  });

  watch(() => props.calendarId, async () => { await loadCalendar(); });

  return {
    activeTab,
    calendarRecord,
    calData,
    masterCalData,
    isLoading,
    isSaving,
    error,
    isAuditModalOpen,
    isPresetsModalOpen,
    hasUnsavedDraft,
    tabsList,
    totalDays,
    setTab,
    saveCalendar,
    deleteCalendar,
    openAuditModal,
    openPresetsModal,
    applyPreset,
    patchCalendarData,
    updateName,
    planetOrbitDays,
    getStateKey,
    getScrollKey,
  };
}

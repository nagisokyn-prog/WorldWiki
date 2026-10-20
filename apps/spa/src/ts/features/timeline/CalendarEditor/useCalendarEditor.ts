import { ref, computed, onMounted, watch } from 'vue';
import { useCalendarStore, type CalendarRecord } from '@/stores/calendar.store';
import { CalendarEngine } from '@/services/Calendars/useCalendarEngine';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type {
  CalendarEditorProps,
  CalendarEditorTab,
  CalendarTabInfo,
  CalendarEditorEmits,
} from './CalendarEditor.model';

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

  const calData = computed<CalendarData | null>(() => {
    return (calendarRecord.value?.data as CalendarData) || null;
  });

  const masterCalData = computed<CalendarData | null>(() => {
    return (masterCalendarRecord.value?.data as CalendarData) || null;
  });

  const totalDays = computed<number>(() => {
    if (!calData.value) return 365;
    const monthsDays = (calData.value.месяцы || []).reduce(
      (sum, m) => sum + (Number(m.дней) || 0),
      0
    );
    const extraDays = Number(calData.value.extra_days) || 0;
    return monthsDays + extraDays;
  });

  const tabsList = computed<CalendarTabInfo[]>(() => [
    {
      id: 'timeGrid',
      label: '1. Время и Сетка',
      icon: '⏰',
      badge: `${totalDays.value} дн`,
    },
    {
      id: 'erasSync',
      label: '2. Летоисчисление & Якорь',
      icon: '🏛️',
      badge: calData.value?.эпохи ? `${calData.value.эпохи.length} эр` : undefined,
    },
    {
      id: 'cultureLore',
      label: '3. Культура и Лор',
      icon: '🎉',
      badge: calData.value?.праздники ? `${calData.value.праздники.length} праздн.` : undefined,
    },
    {
      id: 'playground',
      label: '4. Песочница (1-я глава)',
      icon: '🧪',
      badge: 'Сюжет',
    },
    {
      id: 'reformsDst',
      label: '5. Реформы & DST',
      icon: '🔄',
      badge: 'Стиль',
    },
  ]);

  async function loadCalendar() {
    isLoading.value = true;
    error.value = null;
    try {
      const list = await calendarStore.getCalendars(props.projectId);
      const found = list.find((c) => c.id === props.calendarId) || list[0] || null;
      masterCalendarRecord.value = list.find((c) => c.is_master) || null;

      if (found) {
        calendarRecord.value = JSON.parse(JSON.stringify(found));
        if (!calendarRecord.value?.data) {
          calendarRecord.value!.data = CalendarEngine.getDefaultCalendar();
        }
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
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Не удалось загрузить календарь';
      console.error('[CalendarEditor] Ошибка загрузки:', e);
    } finally {
      isLoading.value = false;
    }
  }

  function patchCalendarData(patch: Partial<CalendarData>) {
    if (!calendarRecord.value) return;
    calendarRecord.value.data = {
      ...calendarRecord.value.data,
      ...patch,
    };
    if (patch.название) {
      calendarRecord.value.name = patch.название;
    }
    if (patch.is_master !== undefined) {
      calendarRecord.value.is_master = patch.is_master;
    }
    emit('update:calendar', calendarRecord.value.data as Record<string, unknown>);
  }

  function updateName(name: string) {
    if (!calendarRecord.value) return;
    calendarRecord.value.name = name;
    if (calendarRecord.value.data) {
      calendarRecord.value.data.название = name;
    }
    emit('update:calendar', calendarRecord.value.data as Record<string, unknown>);
  }

  async function saveCalendar() {
    if (!calendarRecord.value) return;
    isSaving.value = true;
    error.value = null;
    try {
      await calendarStore.saveCalendar(props.projectId, {
        id: calendarRecord.value.id,
        name: calendarRecord.value.name || calendarRecord.value.data?.название || 'Календарь',
        is_default: calendarRecord.value.is_default,
        is_master: calendarRecord.value.is_master,
        data: calendarRecord.value.data,
      });
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
      await calendarStore.deleteCalendar(calendarRecord.value.id);
      emit('delete', calendarRecord.value.id);
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Не удалось удалить календарь';
      console.error('[CalendarEditor] Ошибка удаления:', e);
    }
  }

  function setTab(tab: CalendarEditorTab) {
    activeTab.value = tab;
  }

  function openAuditModal() {
    isAuditModalOpen.value = true;
  }

  onMounted(async () => {
    await loadCalendar();
  });

  watch(
    () => props.calendarId,
    async () => {
      await loadCalendar();
    }
  );

  return {
    activeTab,
    calendarRecord,
    calData,
    masterCalData,
    isLoading,
    isSaving,
    error,
    isAuditModalOpen,
    tabsList,
    totalDays,
    setTab,
    saveCalendar,
    deleteCalendar,
    openAuditModal,
    patchCalendarData,
    updateName,
  };
}

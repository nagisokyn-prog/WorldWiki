import { ref, computed, onMounted, watch } from 'vue';
import { useCalendarStore, type CalendarRecord } from '@/stores/calendar.store';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import type {
  CalendarEditorProps,
  CalendarEditorTab,
  TabItem,
  CalendarEditorEmits,
} from './CalendarEditor.model';

export function useCalendarEditor(
  props: CalendarEditorProps,
  emit: CalendarEditorEmits
) {
  const calendarStore = useCalendarStore();

  const activeTab = ref<CalendarEditorTab>('structure');
  const calendarRecord = ref<CalendarRecord | null>(null);
  const isLoading = ref<boolean>(false);
  const isSaving = ref<boolean>(false);
  const error = ref<string | null>(null);
  const isAuditModalOpen = ref<boolean>(false);

  const calData = computed<CalendarData | null>(() => {
    return (calendarRecord.value?.data as CalendarData) || null;
  });

  const totalDays = computed<number>(() => {
    if (!calData.value) return 365;
    const monthsDays = (calData.value.месяцы || []).reduce(
      (sum, m) => sum + (Number(m.дней) || 0),
      0
    );
    const extraDays = Number(calData.value.дней_вне_месяцев) || 0;
    return monthsDays + extraDays;
  });

  const hasReforms = computed<boolean>(() => {
    const data = calData.value as unknown as Record<string, unknown> | null;
    return Boolean(
      (data?.reforms && Array.isArray(data.reforms) && data.reforms.length > 0) ||
      data?.dst_policy
    );
  });

  const tabsList = computed<TabItem[]>(() => [
    {
      id: 'structure',
      label: '1. Время и Сетка',
      icon: '⏰',
      badge: `${totalDays.value} дн`,
    },
    {
      id: 'astronomy',
      label: '2. Астрономия & Сезоны',
      icon: '🔭',
      badge: calData.value?.сезоны ? `${calData.value.сезоны.length} сез.` : undefined,
    },
    {
      id: 'chronology',
      label: '3. Летоисчисление & Эры',
      icon: '🏛️',
      badge: calData.value?.эпохи ? `${calData.value.эпохи.length} эр` : undefined,
    },
    {
      id: 'syncLeap',
      label: '4. Синхронизация & Високосы',
      icon: '⚙️',
      badge: (calData.value?.високос_настройки as { тип_правила?: string } | undefined)?.тип_правила || 'Високосы',
    },
    {
      id: 'reformsDst',
      label: '5. Реформы & DST',
      icon: '🔄',
      badge: hasReforms.value ? 'Активны' : undefined,
      isWarning: hasReforms.value,
    },
  ]);

  async function loadCalendar() {
    isLoading.value = true;
    error.value = null;
    try {
      const list = await calendarStore.getCalendars(props.projectId);
      const found = list.find((c) => c.id === props.calendarId) || list[0] || null;
      if (found) {
        calendarRecord.value = JSON.parse(JSON.stringify(found));
        if (!calendarRecord.value?.data) {
          calendarRecord.value!.data = CalendarMath.getDefaultCalendar();
        }
      } else {
        const defaultData = CalendarMath.getDefaultCalendar();
        calendarRecord.value = {
          id: props.calendarId || 'cal_new',
          name: defaultData.название || 'Новый календарь',
          is_default: false,
          is_master: false,
          data: defaultData,
        };
      }
    } catch (e) {
      error.value = 'Ошибка загрузки данных календаря';
      console.error(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function saveCalendar() {
    if (!calendarRecord.value || !calendarRecord.value.data) return;
    isSaving.value = true;
    error.value = null;
    try {
      const payload = {
        ...calendarRecord.value.data,
        id: calendarRecord.value.id,
        _id: calendarRecord.value.id,
        is_default: calendarRecord.value.is_default,
        is_master: calendarRecord.value.is_master,
      };
      const ok = await calendarStore.saveCalendar(props.projectId, payload);
      if (ok) {
        emit('save', calendarRecord.value);
        emit('update:calendar', calendarRecord.value);
      } else {
        error.value = 'Не удалось сохранить календарь';
      }
    } catch (e) {
      error.value = 'Ошибка при сохранении календаря';
      console.error(e);
    } finally {
      isSaving.value = false;
    }
  }

  async function deleteCalendar() {
    if (!calendarRecord.value?.id) return;
    try {
      const ok = await calendarStore.deleteCalendar(calendarRecord.value.id);
      if (ok) {
        emit('delete', calendarRecord.value.id);
      }
    } catch (e) {
      error.value = 'Ошибка удаления календаря';
      console.error(e);
    }
  }

  function setTab(tab: CalendarEditorTab) {
    activeTab.value = tab;
  }

  function openAuditModal() {
    isAuditModalOpen.value = true;
    if (calendarRecord.value?.id) {
      emit('audit', calendarRecord.value.id);
    }
  }

  function closeAuditModal() {
    isAuditModalOpen.value = false;
  }

  function patchCalendarData(patch: Partial<CalendarData>) {
    if (!calendarRecord.value?.data) return;
    calendarRecord.value.data = {
      ...calendarRecord.value.data,
      ...patch,
    };
    emit('update:calendar', calendarRecord.value);
  }

  function updateName(name: string) {
    if (!calendarRecord.value) return;
    calendarRecord.value.name = name;
    if (calendarRecord.value.data) {
      calendarRecord.value.data.название = name;
    }
    emit('update:calendar', calendarRecord.value);
  }

  watch(() => props.calendarId, () => {
    loadCalendar();
  });

  onMounted(() => {
    loadCalendar();
  });

  return {
    activeTab,
    calendarRecord,
    calData,
    isLoading,
    isSaving,
    error,
    isAuditModalOpen,
    tabsList,
    totalDays,
    hasReforms,
    setTab,
    loadCalendar,
    saveCalendar,
    deleteCalendar,
    openAuditModal,
    closeAuditModal,
    patchCalendarData,
    updateName,
  };
}

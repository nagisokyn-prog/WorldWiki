import { ref, watch, computed } from 'vue';
import { useCalendarStore } from '../../../stores/calendar.store';
import type { CalendarRecord } from '../../../stores/calendar.store';
import type { CalendarData } from '../../../services/Calendars/calendar.types';
import { CalendarMath } from '../../../services/Calendars/calendar.math';

export interface PanelCalendarItem {
    id?: string;
    is_default?: boolean;
    is_master?: boolean;
    data: CalendarData;
    [key: string]: unknown;
}

export function useCalendarsPanel(props: { project?: string }) {
    const project = computed(() => props.project || '');
    const calendars = ref<PanelCalendarItem[]>([]);
    const expandedCalendars = ref<Set<number>>(new Set());

    const isExpanded = (idx: number) => expandedCalendars.value.has(idx);

    const toggleExpand = (idx: number) => {
        if (expandedCalendars.value.has(idx)) {
            expandedCalendars.value.delete(idx);
        } else {
            expandedCalendars.value.add(idx);
        }
    };

    const loadCalendars = async () => {
        if (!project.value) {
            calendars.value = [];
            return;
        }

        try {
            const list = await useCalendarStore().getCalendars(project.value);

            // Auto-create default calendar if none exist
            if (list.length === 0) {
                const defaultData = CalendarMath.getDefaultCalendar();
                await useCalendarStore().saveCalendar(project.value, { ...defaultData, is_default: true, tempId: `temp_${Date.now()}` });
                const newList = await useCalendarStore().getCalendars(project.value);
                calendars.value = newList.map((c: CalendarRecord) => ({
                    id: c.id,
                    is_default: c.is_default,
                    is_master: c.is_master || (c.data && (c.data as Record<string, unknown>).is_master as boolean),
                    data: (c.data || c) as CalendarData
                }));
            } else {
                calendars.value = list.map((c: CalendarRecord) => ({
                    id: c.id,
                    is_default: c.is_default,
                    is_master: c.is_master || (c.data && (c.data as Record<string, unknown>).is_master as boolean),
                    data: (c.data || c) as CalendarData
                }));
            }

            if (calendars.value.length > 0 && expandedCalendars.value.size === 0) {
                expandedCalendars.value.add(0);
            }
        } catch (error) {
            console.error('Ошибка при загрузке календарей:', error);
        }
    };

    watch(() => project.value, () => {
        loadCalendars();
    }, { immediate: true });

    const addCalendar = async () => {
        const newCal = CalendarMath.getDefaultCalendar();
        newCal.название = `Новый календарь ${calendars.value.length + 1}`;

        const tempPayload = {
            ...newCal,
            is_default: calendars.value.length === 0,
            is_master: calendars.value.length === 0,
            id: undefined
        };

        if (project.value) {
            await useCalendarStore().saveCalendar(project.value, tempPayload);
            await loadCalendars();
            expandedCalendars.value.add(calendars.value.length - 1);
        }
    };

    const saveCalendar = async (idx: number) => {
        if (!project.value) return;

        const cal = calendars.value[idx];
        const payload: CalendarData & { [key: string]: unknown } = {
            ...cal.data,
            название: cal.data.название || 'Календарь',
            is_default: cal.is_default,
            id: cal.id?.startsWith('temp_') ? undefined : cal.id
        };

        try {
            const success = await useCalendarStore().saveCalendar(project.value, payload);
            if (success) {
                // Reload to get real IDs
                await loadCalendars();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const removeCalendar = async (idx: number) => {
        const { appConfirm } = await import('@worldwiki/components');
        if (!await appConfirm('Вы уверены, что хотите удалить этот календарь?')) return;
        if (!project.value) return;

        const cal = calendars.value[idx];
        if (!cal.id?.startsWith('temp_') && cal.id) {
            const success = await useCalendarStore().deleteCalendar(cal.id);
            if (!success) {
                const { appAlert } = await import('@worldwiki/components');
                appAlert('Ошибка при удалении календаря.');
                return;
            }
        }
        calendars.value.splice(idx, 1);
        expandedCalendars.value.delete(idx);
    };

    const setDefault = async (idx: number) => {
        calendars.value.forEach((c, i) => {
            c.is_default = (i === idx);
        });
        await saveAll();
    };

    const saveAll = async () => {
        for (let i = 0; i < calendars.value.length; i++) {
            await saveCalendar(i);
        }
    };

    return {
        project,
        calendars,
        expandedCalendars,
        isExpanded,
        toggleExpand,
        addCalendar,
        saveCalendar,
        removeCalendar,
        setDefault,
        saveAll
    };
}

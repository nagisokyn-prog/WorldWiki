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

            // Календарь Мира (is_master) всегда закреплен сверху первым.
            // Все остальные локальные календари сохраняют порядок добавления внизу.
            calendars.value.sort((a, b) => {
                if (a.is_master && !b.is_master) return -1;
                if (!a.is_master && b.is_master) return 1;
                return 0;
            });

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
            is_default: false,
            is_master: false,
            id: undefined
        };

        if (project.value) {
            await useCalendarStore().saveCalendar(project.value, tempPayload);
            await loadCalendars();
            // Новый календарь создается свернутым внизу списка
        }
    };

    const saveCalendar = async (idx: number, skipReload = false) => {
        if (!project.value) return;

        const cal = calendars.value[idx];
        const idStr = String(cal.id || '').replace(/["'⟨⟩]/g, '').trim();
        let rawData = cal.data;
        if (rawData && typeof rawData === 'object' && 'data' in rawData && typeof (rawData as Record<string, unknown>).data === 'object') {
            rawData = (rawData as Record<string, unknown>).data as CalendarData;
        }

        const payload: CalendarData & { [key: string]: unknown } = {
            ...rawData,
            название: rawData.название || 'Календарь',
            is_default: cal.is_default,
            is_master: cal.is_master,
            id: idStr.startsWith('temp_') ? undefined : idStr
        };

        try {
            const success = await useCalendarStore().saveCalendar(project.value, payload);
            if (success && !skipReload) {
                // Reload to get real IDs only for single manual save
                await loadCalendars();
            }
            return success;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const removeCalendar = async (idx: number) => {
        let confirmed: boolean;
        try {
            const { appConfirm } = await import('@worldwiki/components');
            confirmed = await Promise.race([
                appConfirm('Вы уверены, что хотите удалить этот календарь?'),
                new Promise<boolean>((resolve) => setTimeout(() => {
                    if (!document.querySelector('.app-dialog-overlay')) {
                        resolve(typeof window !== 'undefined' ? window.confirm('Вы уверены, что хотите удалить этот календарь?') : true);
                    }
                }, 300))
            ]);
        } catch {
            confirmed = typeof window !== 'undefined' ? window.confirm('Вы уверены, что хотите удалить этот календарь?') : true;
        }

        if (!confirmed) return;
        if (!project.value) return;

        const cal = calendars.value[idx];
        if (cal) {
            const idStr = String(cal.id || '').replace(/["'⟨⟩]/g, '').trim();
            if (idStr && !idStr.startsWith('temp_')) {
                const success = await useCalendarStore().deleteCalendar(idStr);
                if (!success) {
                    const { appAlert } = await import('@worldwiki/components');
                    appAlert('Ошибка при удалении календаря.');
                    return;
                }
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
            await saveCalendar(i, true);
        }
        await loadCalendars();
    };

    const masterCalendar = computed(() => {
        return calendars.value.find(c => c.is_master)?.data || null;
    });

    const setStoryOrigin = (idx: number) => {
        calendars.value.forEach((c, i) => {
            if (c.data) {
                c.data.is_story_origin = (i === idx);
            }
        });
    };

    const displayCalendars = computed(() => {
        return calendars.value.map((cal, idx) => ({
            ...cal,
            idx,
            isExpanded: expandedCalendars.value.has(idx),
        }));
    });

    return {
        project,
        calendars,
        displayCalendars,
        masterCalendar,
        expandedCalendars,
        isExpanded,
        toggleExpand,
        addCalendar,
        saveCalendar,
        removeCalendar,
        setDefault,
        setStoryOrigin,
        saveAll
    };
}

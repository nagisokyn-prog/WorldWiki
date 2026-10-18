import { ref, watch, computed } from 'vue';
import { useCalendarStore } from '../../../stores/calendar.store';
import type { CalendarRecord } from '../../../stores/calendar.store';
import type { CalendarData, PlanetEntity } from '../../../services/Calendars/calendar.types';
import { CalendarMath } from '../../../services/Calendars/useCalendarEngine';

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
    const planets = ref<PlanetEntity[]>([]);

    const selectedPlanet = ref<PlanetEntity | null>(null);
    const selectedCalendarIdx = ref<number | null>(null);

    const selectedId = computed<string>(() => {
        if (selectedPlanet.value) {
            return `planet:${selectedPlanet.value.id}`;
        }
        if (selectedCalendarIdx.value !== null && selectedCalendarIdx.value >= 0) {
            return `cal:${selectedCalendarIdx.value}`;
        }
        return '';
    });

    const loadPlanets = () => {
        if (!project.value) {
            planets.value = [];
            return;
        }
        planets.value = useCalendarStore().getPlanets(project.value);
        if (planets.value.length > 0 && !selectedPlanet.value && selectedCalendarIdx.value === null) {
            selectedPlanet.value = planets.value[0];
        }
    };

    const loadCalendars = async () => {
        if (!project.value) {
            calendars.value = [];
            return;
        }

        try {
            loadPlanets();
            const list = await useCalendarStore().getCalendars(project.value);

            if (list.length === 0) {
                const defaultData = CalendarMath.getDefaultCalendar();
                defaultData.planet_id = 'earth';
                await useCalendarStore().saveCalendar(project.value, { ...defaultData, is_default: true, tempId: `temp_${Date.now()}` });
                const newList = await useCalendarStore().getCalendars(project.value);
                calendars.value = newList.map((c: CalendarRecord) => ({
                    id: c.id,
                    is_default: c.is_default,
                    is_master: c.is_master || (c.data && (c.data as Record<string, unknown>).is_master as boolean),
                    data: (c.data || c) as CalendarData
                }));
            } else {
                calendars.value = list.map((c: CalendarRecord) => {
                    const d = (c.data || c) as CalendarData;
                    if (!d.planet_id) {
                        d.planet_id = 'earth';
                    }
                    return {
                        id: c.id,
                        is_default: c.is_default,
                        is_master: c.is_master || (c.data && (c.data as Record<string, unknown>).is_master as boolean),
                        data: d
                    };
                });
            }

            if (selectedCalendarIdx.value === null && !selectedPlanet.value) {
                if (planets.value.length > 0) {
                    selectedPlanet.value = planets.value[0];
                } else if (calendars.value.length > 0) {
                    selectedCalendarIdx.value = 0;
                }
            }
        } catch (error) {
            console.error('Ошибка при загрузке календарей:', error);
        }
    };

    watch(() => project.value, () => {
        loadCalendars();
    }, { immediate: true });

    const selectPlanet = (planet: PlanetEntity) => {
        selectedPlanet.value = planet;
        selectedCalendarIdx.value = null;
    };

    const selectCalendar = (calIdx: number) => {
        const cal = calendars.value[calIdx];
        if (cal && (cal.is_master || cal.data?.название === 'Календарь Мира' || cal.data?.calendar_type === 'master')) {
            const pId = cal.data?.planet_id || 'earth';
            const foundPlanet = planets.value.find(p => p.id === pId) || planets.value[0];
            if (foundPlanet) {
                selectPlanet(foundPlanet);
                return;
            }
        }
        selectedCalendarIdx.value = calIdx;
        selectedPlanet.value = null;
    };

    const addPlanet = () => {
        if (!project.value) return;
        const newId = `planet_${Date.now()}`;
        const newPlanet: PlanetEntity = {
            id: newId,
            project_id: project.value,
            name: `Планета ${planets.value.length + 1}`,
            ticks_per_day: 86400,
            orbit_days: 365.2422,
            axial_tilt: 23.44,
            is_retrograde: false,
            moons: []
        };
        useCalendarStore().savePlanet(project.value, newPlanet);
        loadPlanets();
        selectPlanet(newPlanet);
    };

    const savePlanet = (planet: PlanetEntity) => {
        if (!project.value) return;
        useCalendarStore().savePlanet(project.value, planet);
        loadPlanets();
    };

    const deletePlanet = (planetId: string) => {
        if (!project.value) return;
        useCalendarStore().deletePlanet(project.value, planetId);
        loadPlanets();
        if (selectedPlanet.value?.id === planetId) {
            if (planets.value.length > 0) {
                selectPlanet(planets.value[0]);
            } else if (calendars.value.length > 0) {
                selectCalendar(0);
            }
        }
    };

    const addCalendar = async (planetId: string = 'earth') => {
        const newCal = CalendarMath.getDefaultCalendar();
        newCal.planet_id = planetId;
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
            selectCalendar(calendars.value.length - 1);
        }
    };

    const saveCalendar = async (idx: number, skipReload = false) => {
        if (!project.value) return;
        const cal = calendars.value[idx];
        if (!cal) return;

        const idStr = String(cal.id || '').replace(/["'⟨⟩]/g, '').trim();
        let rawData = cal.data;
        if (rawData && typeof rawData === 'object' && 'data' in rawData && typeof (rawData as Record<string, unknown>).data === 'object') {
            rawData = (rawData as Record<string, unknown>).data as CalendarData;
        }

        const payload: CalendarData & { [key: string]: unknown } = {
            ...rawData,
            planet_id: rawData.planet_id || 'earth',
            название: rawData.название || 'Календарь',
            is_default: cal.is_default,
            is_master: cal.is_master,
            id: idStr.startsWith('temp_') ? undefined : idStr
        };

        try {
            const success = await useCalendarStore().saveCalendar(project.value, payload);
            if (success && !skipReload) {
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

        if (!confirmed || !project.value) return;

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
        if (selectedCalendarIdx.value === idx) {
            selectedCalendarIdx.value = calendars.value.length > 0 ? 0 : null;
        }
    };

    const setDefault = async (idx: number) => {
        calendars.value.forEach((c, i) => {
            c.is_default = (i === idx);
            c.is_master = (i === idx);
            if (c.data) {
                c.data.is_master = (i === idx);
                c.data.calendar_type = (i === idx) ? 'master' : 'local';
            }
        });
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

    const isAuditOpen = ref(false);
    const selectedAuditCalendar = ref<CalendarData | null>(null);

    const openAudit = (calData: CalendarData) => {
        selectedAuditCalendar.value = calData;
        isAuditOpen.value = true;
    };

    const saveAll = async () => {
        for (let i = 0; i < calendars.value.length; i++) {
            await saveCalendar(i, true);
        }
        await loadCalendars();
    };

    const selectedCalendarPlanet = computed<PlanetEntity | null>(() => {
        if (selectedCalendarIdx.value === null || !calendars.value[selectedCalendarIdx.value]) return null;
        const cal = calendars.value[selectedCalendarIdx.value];
        const pId = cal.data?.planet_id || 'earth';
        return planets.value.find(p => p.id === pId) || planets.value[0] || null;
    });

    return {
        project,
        calendars,
        planets,
        selectedPlanet,
        selectedCalendarIdx,
        selectedCalendarPlanet,
        selectedId,
        selectPlanet,
        selectCalendar,
        addPlanet,
        savePlanet,
        deletePlanet,
        masterCalendar,
        addCalendar,
        saveCalendar,
        removeCalendar,
        setDefault,
        setStoryOrigin,
        saveAll,
        isAuditOpen,
        selectedAuditCalendar,
        openAudit,
    };
}

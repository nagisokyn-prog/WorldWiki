import { ref, computed, onMounted } from 'vue';
import type { CalendarRecord } from '@/stores/calendar.store';
import { useCalendarStore } from '@/stores/calendar.store';
import type {
  CalendarEntityAdapterProps,
  CalendarEntityAdapterEmits,
  CalendarAdapterMode,
} from './CalendarEntityAdapter.model';
import type { PlanetEntity } from '../Calendars/PlanetCalendarTree/PlanetCalendarTree.model';
import type { CalendarData } from '@/services/Calendars/calendar.types';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';

export function useCalendarEntityAdapter(
  props: CalendarEntityAdapterProps,
  emit: CalendarEntityAdapterEmits
) {
  const calendarStore = useCalendarStore();

  const activeMode = ref<CalendarAdapterMode>('calendar');
  const selectedPlanetId = ref<string>('earth');
  const selectedCalendarId = ref<string>(props.calendarId);
  const currentCalendarRecord = ref<CalendarRecord | null>(null);
  const rawCalendarsList = ref<CalendarRecord[]>([]);

  const selectedNodeId = computed<string>(() => {
    return activeMode.value === 'planet'
      ? `planet:${selectedPlanetId.value}`
      : `cal:${selectedCalendarId.value}`;
  });

  const planetsList = ref<PlanetEntity[]>([]);

  const calendarsList = computed(() => {
    return rawCalendarsList.value.map((c, idx) => ({
      id: c.id,
      idx,
      name: c.name || c.data?.название || `Календарь ${idx + 1}`,
      planet_id: (c.data?.planet_id as string) || (planetsList.value[0]?.id ?? 'earth'),
      is_master: c.is_master,
      data: (c.data || {}) as CalendarData,
    }));
  });

  async function loadData() {
    try {
      planetsList.value = calendarStore.getPlanets(props.projectId);
      rawCalendarsList.value = await calendarStore.getCalendars(props.projectId);
      if (props.calendarId) {
        selectedCalendarId.value = props.calendarId;
      }
    } catch (e) {
      console.error('[CalendarEntityAdapter] Ошибка загрузки календарей:', e);
    }
  }

  function onSelectPlanet(planet: PlanetEntity) {
    activeMode.value = 'planet';
    selectedPlanetId.value = planet.id;
  }

  function onSelectCalendar(calIdx: number) {
    activeMode.value = 'calendar';
    const found = rawCalendarsList.value[calIdx];
    if (found && found.id) {
      selectedCalendarId.value = found.id;
    }
  }

  function onAddPlanet() {
    const newId = `planet_${Date.now()}`;
    const newPlanet: PlanetEntity = {
      id: newId,
      project_id: props.projectId,
      name: `Новая планета ${planetsList.value.length + 1}`,
      ticks_per_day: 86400,
      orbit_days: 365.25,
      axial_tilt: 23.5,
    };
    calendarStore.savePlanet(props.projectId, newPlanet);
    planetsList.value = calendarStore.getPlanets(props.projectId);
    activeMode.value = 'planet';
    selectedPlanetId.value = newId;
    emit('modified');
  }

  async function onAddCalendar(planetId: string) {
    try {
      const defaultData = CalendarMath.getDefaultCalendar();
      defaultData.название = `Новый календарь ${rawCalendarsList.value.length + 1}`;
      defaultData.planet_id = planetId;
      await calendarStore.saveCalendar(props.projectId, {
        ...defaultData,
        is_default: false,
        is_master: false,
      } as unknown as CalendarData);
      rawCalendarsList.value = await calendarStore.getCalendars(props.projectId);
      activeMode.value = 'calendar';
      emit('modified');
    } catch (e) {
      console.error('[CalendarEntityAdapter] Ошибка создания календаря:', e);
    }
  }

  function onCalendarUpdate(calendar: CalendarRecord) {
    currentCalendarRecord.value = calendar;
    const serializable: Record<string, unknown> = {
      id: calendar.id,
      name: calendar.name,
      is_master: calendar.is_master,
      is_default: calendar.is_default,
      ...(calendar.data || {}),
    };
    emit('update:modelValue', serializable);
    emit('modified');
  }

  function onCalendarSave(calendar: CalendarRecord) {
    currentCalendarRecord.value = calendar;
    emit('save', calendar);
  }

  function onPlanetSave() {
    emit('modified');
  }

  onMounted(async () => {
    await loadData();
  });

  return {
    activeMode,
    selectedPlanetId,
    selectedCalendarId,
    selectedNodeId,
    planetsList,
    calendarsList,
    currentCalendarRecord,
    onSelectPlanet,
    onSelectCalendar,
    onAddPlanet,
    onAddCalendar,
    onCalendarUpdate,
    onCalendarSave,
    onPlanetSave,
  };
}

import { ref, computed, onMounted } from 'vue';
import type { CalendarRecord } from '@/stores/calendar.store';
import { useCalendarStore } from '@/stores/calendar.store';
import type {
  CalendarEntityAdapterProps,
  CalendarEntityAdapterEmits,
  CalendarAdapterMode,
} from './CalendarEntityAdapter.model';
import type { PlanetNode, CalendarNode } from '../Calendars/PlanetCalendarTree/PlanetCalendarTree.model';

export function useCalendarEntityAdapter(
  props: CalendarEntityAdapterProps,
  emit: CalendarEntityAdapterEmits
) {
  const calendarStore = useCalendarStore();

  const activeMode = ref<CalendarAdapterMode>('calendar');
  const selectedPlanetId = ref<string>('earth_default');
  const selectedCalendarId = ref<string>(props.calendarId);
  const currentCalendarRecord = ref<CalendarRecord | null>(null);

  const selectedNodeId = computed<string>(() => {
    return activeMode.value === 'planet'
      ? `planet:${selectedPlanetId.value}`
      : `cal:${selectedCalendarId.value}`;
  });

  const planetsList = ref<PlanetNode[]>([
    { id: 'earth_default', name: 'Земля (Earth)', orbit_days: 365.2422 },
  ]);

  const calendarsList = computed<CalendarNode[]>(() => {
    return calendarStore.calendars.map((c, idx) => ({
      idx,
      name: c.name || c.data?.название || `Календарь ${idx + 1}`,
      planet_id: (c.data as any)?.planet_id || 'earth_default',
      is_master: c.is_master,
    }));
  });

  async function loadData() {
    try {
      await calendarStore.getCalendars(props.projectId);
      if (props.calendarId) {
        selectedCalendarId.value = props.calendarId;
      }
    } catch (e) {
      console.error('[CalendarEntityAdapter] Ошибка загрузки календарей:', e);
    }
  }

  function onSelectPlanet(planet: PlanetNode) {
    activeMode.value = 'planet';
    selectedPlanetId.value = planet.id;
  }

  function onSelectCalendar(calIdx: number) {
    activeMode.value = 'calendar';
    const found = calendarStore.calendars[calIdx];
    if (found && found.id) {
      selectedCalendarId.value = found.id;
    }
  }

  function onAddPlanet() {
    const newId = `planet_${Date.now()}`;
    planetsList.value.push({
      id: newId,
      name: `Новая планета ${planetsList.value.length + 1}`,
      orbit_days: 365.0,
    });
    activeMode.value = 'planet';
    selectedPlanetId.value = newId;
  }

  async function onAddCalendar(planetId: string) {
    try {
      await calendarStore.saveCalendar(props.projectId, {
        name: 'Новый календарь',
        is_default: false,
        is_master: false,
        data: {
          название: 'Новый календарь',
          planet_id: planetId,
        } as any,
      });
      await calendarStore.getCalendars(props.projectId);
      activeMode.value = 'calendar';
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

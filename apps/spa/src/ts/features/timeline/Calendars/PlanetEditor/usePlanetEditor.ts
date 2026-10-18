/**
 * @file usePlanetEditor.ts
 * @description Composable для управления состоянием, астрофизикой, солнцестояниями,
 * географическими регионами и часовыми поясами планеты.
 */

import { reactive, ref, computed, watch } from 'vue';
import type {
  PlanetEditorProps,
  PlanetEditorEmits,
  PlanetEntity,
  WorldRegion,
  AstronomicalPoints,
} from './PlanetEditor.model';

export function usePlanetEditor(props: PlanetEditorProps, emit: PlanetEditorEmits) {
  const localPlanet = reactive<PlanetEntity>({
    id: props.planet.id,
    project_id: props.planet.project_id,
    name: props.planet.name || 'Новая планета',
    ticks_per_day: props.planet.ticks_per_day || 86400,
    orbit_days: props.planet.orbit_days || 365.2422,
    axial_tilt: props.planet.axial_tilt ?? 23.44,
    is_retrograde: Boolean(props.planet.is_retrograde),
    solstice_world_day: props.planet.solstice_world_day ?? 355,
    moons: props.planet.moons ? [...props.planet.moons] : [],
    timezones: props.planet.timezones ? [...props.planet.timezones] : [],
    regions: props.planet.regions ? [...props.planet.regions] : [],
  });

  const dayHours = ref(Math.floor((localPlanet.ticks_per_day || 86400) / 3600));
  const dayMinutes = ref(Math.floor(((localPlanet.ticks_per_day || 86400) % 3600) / 60));
  const daySeconds = ref((localPlanet.ticks_per_day || 86400) % 60);

  const syncDayTimeFromTicks = (ticks: number) => {
    const validTicks = Math.max(1, ticks || 86400);
    dayHours.value = Math.floor(validTicks / 3600);
    dayMinutes.value = Math.floor((validTicks % 3600) / 60);
    daySeconds.value = validTicks % 60;
  };

  const onDayTimeChange = () => {
    const h = Math.max(0, Number(dayHours.value) || 0);
    const m = Math.max(0, Math.min(59, Number(dayMinutes.value) || 0));
    const s = Math.max(0, Math.min(59, Number(daySeconds.value) || 0));
    localPlanet.ticks_per_day = Math.max(1, (h * 3600) + (m * 60) + s);
    notifyChange();
  };

  watch(
    () => props.planet,
    (newVal) => {
      localPlanet.id = newVal.id;
      localPlanet.project_id = newVal.project_id;
      localPlanet.name = newVal.name || 'Планета';
      localPlanet.ticks_per_day = newVal.ticks_per_day || 86400;
      localPlanet.orbit_days = newVal.orbit_days || 365.2422;
      localPlanet.axial_tilt = newVal.axial_tilt ?? 23.44;
      localPlanet.is_retrograde = Boolean(newVal.is_retrograde);
      localPlanet.solstice_world_day = newVal.solstice_world_day ?? 355;
      localPlanet.moons = newVal.moons ? [...newVal.moons] : [];
      localPlanet.timezones = newVal.timezones ? [...newVal.timezones] : [];
      localPlanet.regions = newVal.regions ? [...newVal.regions] : [];
      syncDayTimeFromTicks(localPlanet.ticks_per_day);
    },
    { deep: true }
  );

  const notifyChange = () => {
    emit('update:planet', { ...localPlanet });
  };

  // ❄️☀️ Астрономические точки года (округляются до целых дней года для писателя)
  const astronomicalPoints = computed<AstronomicalPoints>(() => {
    const orbit = Math.max(1, localPlanet.orbit_days || 365.2422);
    const winter = Math.round(((localPlanet.solstice_world_day ?? 355) % orbit + orbit) % orbit);
    const spring = Math.round((winter + orbit * 0.25) % orbit);
    const summer = Math.round((winter + orbit * 0.5) % orbit);
    const autumn = Math.round((winter + orbit * 0.75) % orbit);

    return {
      winterSolstice: winter,
      springEquinox: spring,
      summerSolstice: summer,
      autumnEquinox: autumn,
    };
  });

  // 🧮 Калькулятор дня солнцестояния из культурного календаря
  const isSolsticeCalcOpen = ref(false);
  const calcCalendarIdx = ref(0);
  const calcMonthIdx = ref(0);
  const calcDay = ref(21);

  const availableCalendars = computed(() => {
    return (props.calendars || []).map((c) => c.data).filter(Boolean);
  });

  const selectedCalcCalendar = computed(() => {
    return availableCalendars.value[calcCalendarIdx.value] || availableCalendars.value[0] || null;
  });

  const calcMonths = computed(() => {
    return selectedCalcCalendar.value?.месяцы || [];
  });

  const calcMaxDays = computed(() => {
    return calcMonths.value[calcMonthIdx.value]?.дней || 31;
  });

  const applySolsticeFromCalendar = () => {
    let dayOfYear = 0;
    const months = calcMonths.value;
    for (let i = 0; i < calcMonthIdx.value && i < months.length; i++) {
      dayOfYear += months[i]?.дней || 0;
    }
    dayOfYear += Math.max(1, Math.min(calcMaxDays.value, Number(calcDay.value) || 1));
    localPlanet.solstice_world_day = dayOfYear;
    notifyChange();
  };

  const solsticeHumanExplanation = computed(() => {
    const day = localPlanet.solstice_world_day ?? 355;
    const cal = selectedCalcCalendar.value;
    if (cal && cal.месяцы && cal.месяцы.length > 0) {
      let rem = day;
      let monthName = cal.месяцы[0].название || 'Месяц 1';
      let dayInMonth = rem;
      for (let i = 0; i < cal.месяцы.length; i++) {
        const mDays = cal.месяцы[i].дней || 30;
        if (rem <= mDays) {
          monthName = cal.месяцы[i].название || `Месяц ${i + 1}`;
          dayInMonth = rem;
          break;
        }
        rem -= mDays;
      }
      return `💡 ${day}-й день года соответствует дате: ${dayInMonth} ${monthName} (календарь «${cal.название || 'Календарь'}»).`;
    }
    return `💡 ${day}-й день на физической орбитальной шкале планеты.`;
  });


  // 🌍 Часовые пояса
  const addTimezone = () => {
    if (!localPlanet.timezones) {
      localPlanet.timezones = [];
    }
    const idx = localPlanet.timezones.length + 1;
    localPlanet.timezones.push({
      id: `tz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `Часовой пояс ${idx}`,
      code: `TZ${idx}`,
      base_offset_hours: 0,
    });
    notifyChange();
  };

  const removeTimezone = (index: number) => {
    if (!localPlanet.timezones || index < 0 || index >= localPlanet.timezones.length) return;
    localPlanet.timezones.splice(index, 1);
    notifyChange();
  };

  // 🗺️ Географические регионы
  const addRegion = () => {
    if (!localPlanet.regions) {
      localPlanet.regions = [];
    }
    const idx = localPlanet.regions.length + 1;
    const defaultTzId = localPlanet.timezones?.[0]?.id || '';
    localPlanet.regions.push({
      id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `Регион ${idx}`,
      timezone_id: defaultTzId,
      latitude: 45,
      longitude: 0,
      summer_day_hours: 16,
      winter_day_hours: 8,
    });
    notifyChange();
  };

  const removeRegion = (index: number) => {
    if (!localPlanet.regions || index < 0 || index >= localPlanet.regions.length) return;
    localPlanet.regions.splice(index, 1);
    notifyChange();
  };

  const calculateDaylightForRegion = (reg: WorldRegion) => {
    const totalHours = (localPlanet.ticks_per_day || 86400) / 3600;
    const phi = ((reg.latitude || 0) * Math.PI) / 180;
    const eps = ((localPlanet.axial_tilt ?? 23.44) * Math.PI) / 180;

    const tanPhi = Math.tan(phi);
    const tanEps = Math.tan(eps);
    const val = tanPhi * tanEps;

    let summerFraction: number;
    let winterFraction: number;

    // Проверка на полярный круг
    const polarLimit = Math.PI / 2 - eps;
    if (Math.abs(phi) >= polarLimit) {
      // За полярным кругом: полярный день летом, полярная ночь зимой
      summerFraction = 1.0;
      winterFraction = 0.0;
    } else {
      const clampedSummer = Math.min(1, Math.max(-1, -val));
      const clampedWinter = Math.min(1, Math.max(-1, val));
      summerFraction = Math.acos(clampedSummer) / Math.PI;
      winterFraction = Math.acos(clampedWinter) / Math.PI;
    }

    if (phi < 0) {
      // Для южного полушария местное лето наступает при обратном склонении
      const temp = summerFraction;
      summerFraction = Math.max(temp, winterFraction);
      winterFraction = Math.min(temp, winterFraction);
    }

    reg.summer_day_hours = Number((summerFraction * totalHours).toFixed(2));
    reg.winter_day_hours = Number((winterFraction * totalHours).toFixed(2));
    notifyChange();
  };

  const getSummerHours = (reg: WorldRegion) => Math.floor(reg.summer_day_hours ?? 12);
  const getSummerMinutes = (reg: WorldRegion) => {
    const frac = (reg.summer_day_hours ?? 12) - Math.floor(reg.summer_day_hours ?? 12);
    return Math.round(frac * 60);
  };
  const setSummerHours = (reg: WorldRegion, h: number) => {
    const curM = getSummerMinutes(reg);
    reg.summer_day_hours = Number((Math.max(0, h) + curM / 60).toFixed(2));
    notifyChange();
  };
  const setSummerMinutes = (reg: WorldRegion, m: number) => {
    const curH = getSummerHours(reg);
    reg.summer_day_hours = Number((curH + Math.max(0, Math.min(59, m)) / 60).toFixed(2));
    notifyChange();
  };

  const getWinterHours = (reg: WorldRegion) => Math.floor(reg.winter_day_hours ?? 12);
  const getWinterMinutes = (reg: WorldRegion) => {
    const frac = (reg.winter_day_hours ?? 12) - Math.floor(reg.winter_day_hours ?? 12);
    return Math.round(frac * 60);
  };
  const setWinterHours = (reg: WorldRegion, h: number) => {
    const curM = getWinterMinutes(reg);
    reg.winter_day_hours = Number((Math.max(0, h) + curM / 60).toFixed(2));
    notifyChange();
  };
  const setWinterMinutes = (reg: WorldRegion, m: number) => {
    const curH = getWinterHours(reg);
    reg.winter_day_hours = Number((curH + Math.max(0, Math.min(59, m)) / 60).toFixed(2));
    notifyChange();
  };

  // 🌕 Луны и спутники
  const addMoon = () => {
    if (!localPlanet.moons) {
      localPlanet.moons = [];
    }
    const idx = localPlanet.moons.length + 1;
    localPlanet.moons.push({
      name: `Спутник ${idx}`,
      period_days: 28,
      period_days_num: 28000,
      period_days_den: 1000,
      initial_phase: 0,
      initial_phase_bp: 0,
    });
    notifyChange();
  };

  const removeMoon = (index: number) => {
    if (!localPlanet.moons || index < 0 || index >= localPlanet.moons.length) return;
    localPlanet.moons.splice(index, 1);
    notifyChange();
  };

  const save = () => {
    emit('save', { ...localPlanet });
  };

  const remove = () => {
    emit('delete', localPlanet.id);
  };

  return {
    localPlanet,
    dayHours,
    dayMinutes,
    daySeconds,
    onDayTimeChange,
    notifyChange,
    astronomicalPoints,
    isSolsticeCalcOpen,
    calcCalendarIdx,
    calcMonthIdx,
    calcDay,
    availableCalendars,
    selectedCalcCalendar,
    calcMonths,
    calcMaxDays,
    applySolsticeFromCalendar,
    solsticeHumanExplanation,
    addTimezone,
    removeTimezone,
    addRegion,
    removeRegion,
    calculateDaylightForRegion,
    getSummerHours,
    getSummerMinutes,
    setSummerHours,
    setSummerMinutes,
    getWinterHours,
    getWinterMinutes,
    setWinterHours,
    setWinterMinutes,
    addMoon,
    removeMoon,
    save,
    remove,
  };
}

import { CalendarMath } from '@/services/Calendars/useCalendarEngine';
import type {
  CalendarData,
  WorldMoment,
  WorldRegion,
  WorldTimezone,
} from '@/services/Calendars/calendar.types';
import {
  resolveLocationGeography,
  cleanEntityId,
  type GeographyEntityRecord,
} from '@/services/Geography/locationHierarchy';
import type { WorldSliceFilter, WorldTimeSnapshotItem } from './tabs/TimeAtlasWorldTab.model';

export function buildWorldTimeSnapshot(params: {
  master: CalendarData | null;
  currentWorldMinute: number;
  moment: WorldMoment;
  tzs: WorldTimezone[];
  regions: WorldRegion[];
  projectEntities: GeographyEntityRecord[];
  filter: WorldSliceFilter;
}): WorldTimeSnapshotItem[] {
  const { master, currentWorldMinute, moment, tzs, regions, projectEntities, filter } = params;
  if (!master) return [];

  const items: WorldTimeSnapshotItem[] = [];
  const coveredTzKeys = new Set<string>();
  const coveredNames = new Set<string>();

  const formatForOffset = (offsetHours: number) => {
    const localInput = CalendarMath.worldMomentToDate(moment, master, offsetHours);
    const localDateFormatted = CalendarMath.formatDate(master, {
      absolute_minute: currentWorldMinute,
      calendar_id: master._id || '',
      original_input: localInput,
    });
    const hh = String(localInput.hour ?? 0).padStart(2, '0');
    const mm = String(localInput.minute ?? 0).padStart(2, '0');
    return { localDateFormatted, localTimeStr: `${hh}:${mm}` };
  };

  for (const region of regions) {
    const tz = tzs.find(
      (t) =>
        t.id === region.timezone_id ||
        (t.code && t.code === region.timezone_id) ||
        t.name === region.timezone_id
    );
    if (tz) {
      if (tz.id) coveredTzKeys.add(tz.id);
      if (tz.code) coveredTzKeys.add(tz.code);
    }
    if (region.name) coveredNames.add(region.name.toLowerCase());

    const offsetHours = tz ? CalendarMath.getTimezoneOffsetForDay(tz, moment.day_index) : 0;
    const { localDateFormatted, localTimeStr } = formatForOffset(offsetHours);
    const sunStatus = CalendarMath.calculateSunForRegion(region, moment, master, tzs, offsetHours);

    items.push({ region, timezone: tz, offsetHours, localTimeStr, localDateFormatted, sunStatus });
  }

  const locationEntities = projectEntities.filter((ent) => {
    const eType = String(ent.entity_type ?? '');
    return eType === 'location' || (!eType && ent['столица'] === undefined);
  });

  for (const locEnt of locationEntities) {
    const geo = resolveLocationGeography(locEnt, projectEntities, tzs, moment.day_index);
    if (coveredNames.has(geo.entityName.toLowerCase())) continue;
    const isRelevantLocation = geo.isStateCapital || geo.hasExplicitGeography || geo.isInherited || geo.scale === 'settlement';
    if (!isRelevantLocation) continue;

    coveredNames.add(geo.entityName.toLowerCase());
    if (geo.timezoneId) coveredTzKeys.add(geo.timezoneId);

    const offsetHours = geo.offsetHours;
    const { localDateFormatted, localTimeStr } = formatForOffset(offsetHours);
    const locRegion: WorldRegion = {
      id: `entity_loc_${geo.entityId}`,
      name: geo.entityName,
      timezone_id: geo.timezoneId || 'tz_utc',
      latitude: geo.latitude ?? 0,
      longitude: geo.longitude ?? offsetHours * 15,
    };
    const matchedTz = tzs.find((t) => t.id === geo.timezoneId || t.base_offset_hours === offsetHours);
    const sunStatus = CalendarMath.calculateSunForRegion(locRegion, moment, master, tzs, offsetHours);

    items.push({
      region: locRegion,
      timezone: matchedTz,
      offsetHours,
      localTimeStr,
      localDateFormatted,
      sunStatus,
      entityId: cleanEntityId(locEnt.id) || geo.entityId,
      scale: geo.scale,
      stateName: geo.stateName,
      isStateCapital: geo.isStateCapital,
      isInherited: geo.isInherited,
      inheritedFromName: geo.inheritedFromName,
    });
  }

  for (const tz of tzs) {
    if (coveredTzKeys.has(tz.id) || (tz.code && coveredTzKeys.has(tz.code))) continue;
    const offsetHours = CalendarMath.getTimezoneOffsetForDay(tz, moment.day_index);
    const { localDateFormatted, localTimeStr } = formatForOffset(offsetHours);
    const sign = offsetHours >= 0 ? '+' : '';
    const synthRegion: WorldRegion = {
      id: `reg_auto_${tz.id || tz.code}`,
      name: tz.name || tz.code || `Пояс ${sign}${offsetHours}`,
      timezone_id: tz.id,
      latitude: 0,
      longitude: offsetHours * 15,
    };
    const sunStatus = CalendarMath.calculateSunForRegion(synthRegion, moment, master, tzs, offsetHours);
    items.push({ region: synthRegion, timezone: tz, offsetHours, localTimeStr, localDateFormatted, sunStatus });
  }

  return items
    .filter((item) => {
      if (filter === 'capitals') return Boolean(item.isStateCapital);
      if (filter === 'settlements') return Boolean(item.entityId) || !item.region.id.startsWith('reg_auto_');
      return true;
    })
    .sort((a, b) => a.offsetHours - b.offsetHours);
}


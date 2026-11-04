import { CalendarMath } from '../Calendars/useCalendarEngine';
import type { WorldTimezone } from '../Calendars/calendar.types';
import {
  LOCATION_SCALE_LABELS,
  type BuildingSubtype,
  type ComputedLocationTime,
  type GeographyEntityRecord,
  type LocationBreadcrumb,
  type LocationScale,
  type ResolvedLocationGeography,
} from './locationHierarchy.types';
import { computeLocationLocalTime, getSunPhaseEmoji } from './locationTime';

export {
  LOCATION_SCALE_LABELS,
  computeLocationLocalTime,
  getSunPhaseEmoji,
  type BuildingSubtype,
  type ComputedLocationTime,
  type GeographyEntityRecord,
  type LocationBreadcrumb,
  type LocationScale,
  type ResolvedLocationGeography,
};

export function cleanEntityId(rawId: unknown): string {
  if (!rawId) return '';
  if (typeof rawId === 'object' && rawId !== null) {
    const obj = rawId as Record<string, unknown>;
    if (obj.id) return cleanEntityId(obj.id);
    if (obj.String) return cleanEntityId(obj.String);
    return '';
  }
  return String(rawId).replace(/^⟨|⟩$/g, '').replace(/^[a-zA-Z0-9_-]+:/, '').replace(/^⟨|⟩$/g, '').trim();
}

export function getEntityField(entity: GeographyEntityRecord | null | undefined, key: string): unknown {
  if (!entity || typeof entity !== 'object') return undefined;
  if (entity[key] !== undefined && entity[key] !== null && entity[key] !== '') return entity[key];
  for (const sub of ['attributes', 'data'] as const) {
    const bag = entity[sub];
    if (bag && typeof bag === 'object') {
      const val = (bag as Record<string, unknown>)[key];
      if (val !== undefined && val !== null && val !== '') return val;
    }
  }
  return undefined;
}

export function getEntityName(entity: GeographyEntityRecord | null | undefined): string {
  if (!entity) return '';
  const raw =
    getEntityField(entity, 'название') ??
    getEntityField(entity, 'name') ??
    getEntityField(entity, 'title') ??
    getEntityField(entity, 'label') ??
    '';
  return String(raw).trim();
}

export function parseNumberOrNull(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

export function parseTimezoneOffset(
  rawTz: unknown,
  timezones: WorldTimezone[] = [],
  dayIndex: number = 0,
  longitude: number | null = null
): { timezoneId: string; offsetHours: number; matchedTz?: WorldTimezone } {
  const str = rawTz !== undefined && rawTz !== null ? String(rawTz).trim() : '';
  if (str) {
    const lower = str.toLowerCase();
    const matched = timezones.find(
      (tz) =>
        tz.id.toLowerCase() === lower ||
        (tz.code && tz.code.toLowerCase() === lower) ||
        tz.name.toLowerCase() === lower ||
        (lower === 'tz_utc' && (tz.code === 'UTC' || tz.base_offset_hours === 0)) ||
        (lower === 'tz_msk' && (tz.code === 'MSK' || tz.base_offset_hours === 3))
    );
    if (matched) {
      return { timezoneId: matched.id, offsetHours: CalendarMath.getTimezoneOffsetForDay(matched, dayIndex), matchedTz: matched };
    }
    if (['utc', 'gmt', 'z', 'tz_utc'].includes(lower)) return { timezoneId: 'tz_utc', offsetHours: 0 };
    if (['msk', 'tz_msk'].includes(lower)) return { timezoneId: 'tz_msk', offsetHours: 3 };

    const offsetMatch = str.match(/^(?:utc|gmt)?\s*([+-]?\d+(?:[.,]\d+)?)(?::(\d{1,2}))?$/i);
    if (offsetMatch) {
      const hoursPart = parseFloat(offsetMatch[1].replace(',', '.'));
      const minsPart = offsetMatch[2] ? parseInt(offsetMatch[2], 10) : 0;
      const sign = hoursPart < 0 || offsetMatch[1].startsWith('-') ? -1 : 1;
      const total = hoursPart + sign * (minsPart / 60);
      if (Number.isFinite(total)) {
        const clamped = Math.max(-24, Math.min(24, total));
        const byOffset = timezones.find((tz) => tz.base_offset_hours === clamped);
        return { timezoneId: byOffset?.id || str, offsetHours: clamped, matchedTz: byOffset };
      }
    }
  }
  if (longitude !== null && Number.isFinite(longitude)) {
    const solarOffset = Math.round(longitude / 15);
    const byOffset = timezones.find((tz) => tz.base_offset_hours === solarOffset);
    return { timezoneId: byOffset?.id || `solar_${solarOffset >= 0 ? '+' : ''}${solarOffset}`, offsetHours: solarOffset, matchedTz: byOffset };
  }
  return { timezoneId: '', offsetHours: 0 };
}

export function mapLegacyScale(entity: GeographyEntityRecord): string {
  const explicit = getEntityField(entity, 'scale_level');
  if (explicit) return String(explicit);
  const legacy = String(getEntityField(entity, 'тип_локации') ?? '').toLowerCase();
  if (['interior', 'room', 'интерьер'].includes(legacy)) return 'interior';
  if (['building', 'здание'].includes(legacy)) return 'building';
  if (['district', 'район'].includes(legacy)) return 'district';
  if (['city', 'settlement', 'город'].includes(legacy)) return 'settlement';
  if (['region', 'forest', 'mountain', 'sea'].includes(legacy)) return 'region';
  if (['planet', 'macro', 'space'].includes(legacy)) return 'macro';
  return 'settlement';
}

export function resolveLocationGeography(
  target: GeographyEntityRecord,
  allEntities: GeographyEntityRecord[] = [],
  timezones: WorldTimezone[] = [],
  dayIndex: number = 0
): ResolvedLocationGeography {
  const byId = new Map<string, GeographyEntityRecord>();
  const byName = new Map<string, GeographyEntityRecord>();
  const stateEntities: GeographyEntityRecord[] = [];

  for (const ent of allEntities) {
    const cid = cleanEntityId(ent.id);
    if (cid) byId.set(cid, ent);
    const name = getEntityName(ent);
    if (name) byName.set(name.toLowerCase(), ent);
    const eType = String(ent.entity_type ?? getEntityField(ent, 'entity_type') ?? '');
    if (eType === 'state' || getEntityField(ent, 'столица') !== undefined) stateEntities.push(ent);
  }

  const findEntity = (refVal: unknown): GeographyEntityRecord | undefined => {
    if (!refVal) return undefined;
    const cid = cleanEntityId(refVal);
    if (cid && byId.has(cid)) return byId.get(cid);
    return byName.get(String(refVal).trim().toLowerCase());
  };

  const targetId = cleanEntityId(target.id) || 'current';
  const targetName = getEntityName(target) || 'Локация';
  const scale = mapLegacyScale(target);
  const buildingSubtype = String(getEntityField(target, 'тип_заведения') ?? '');

  let latitude: number | null = null;
  let longitude: number | null = null;
  let timezoneRaw = '';
  let planetId: string | null = null;
  let climateZone: string | null = null;
  let stateId: string | null = null;
  let inheritedFromId: string | null = null;
  let inheritedFromName: string | null = null;

  const chain: GeographyEntityRecord[] = [];
  const visited = new Set<string>();
  let cursor: GeographyEntityRecord | undefined = target;
  let depth = 0;

  while (cursor && depth < 10) {
    const cid = cleanEntityId(cursor.id) || `node_${depth}`;
    if (visited.has(cid)) break;
    visited.add(cid);
    chain.push(cursor);

    const nodeLat = parseNumberOrNull(getEntityField(cursor, 'широта') ?? getEntityField(cursor, 'latitude'));
    const nodeLon = parseNumberOrNull(getEntityField(cursor, 'долгота') ?? getEntityField(cursor, 'longitude'));
    const nodeTz = String(getEntityField(cursor, 'часовой_пояс') ?? getEntityField(cursor, 'timezone') ?? getEntityField(cursor, 'timezone_id') ?? '').trim();
    const nodePlanet = getEntityField(cursor, 'планета_id') ?? getEntityField(cursor, 'planet_id');
    const nodeClimate = getEntityField(cursor, 'климатический_пояс') ?? getEntityField(cursor, 'climate_zone');
    const nodeState = getEntityField(cursor, 'принадлежность_государству') ?? getEntityField(cursor, 'state_id');

    const markInherited = () => {
      if (depth > 0 && !inheritedFromId && cursor) {
        inheritedFromId = cid;
        inheritedFromName = getEntityName(cursor) || cid;
      }
    };
    if (latitude === null && nodeLat !== null) { latitude = nodeLat; markInherited(); }
    if (longitude === null && nodeLon !== null) { longitude = nodeLon; markInherited(); }
    if (!timezoneRaw && nodeTz) { timezoneRaw = nodeTz; markInherited(); }
    if (!planetId && nodePlanet) planetId = String(nodePlanet);
    if (!climateZone && nodeClimate) climateZone = String(nodeClimate);
    if (!stateId && nodeState) stateId = String(nodeState);

    cursor = findEntity(getEntityField(cursor, 'родительская_локация') ?? getEntityField(cursor, 'parent_id'));
    depth++;
  }

  const breadcrumbs: LocationBreadcrumb[] = chain.slice().reverse().map((node, idx) => ({
    id: cleanEntityId(node.id) || `step_${idx}`,
    name: getEntityName(node) || 'Локация',
    scale: mapLegacyScale(node),
  }));

  let resolvedState: GeographyEntityRecord | undefined = stateId ? findEntity(stateId) : undefined;
  let isStateCapital = false;

  for (const st of stateEntities) {
    const capRef = getEntityField(st, 'столица') ?? getEntityField(st, 'capital_id');
    const capClean = cleanEntityId(capRef);
    const capName = String(capRef ?? '').trim().toLowerCase();
    if ((capClean && capClean === targetId) || (capName && targetName.toLowerCase() === capName)) {
      isStateCapital = true;
      if (!resolvedState) {
        resolvedState = st;
        stateId = cleanEntityId(st.id) || getEntityName(st);
      }
      break;
    }
  }

  let stateName: string | null = null;
  let officialCalendarId: string | null = null;

  if (resolvedState) {
    stateName = getEntityName(resolvedState) || null;
    const stateCal = getEntityField(resolvedState, 'официальный_календарь');
    if (stateCal) officialCalendarId = String(stateCal);

    const stateTz = getEntityField(resolvedState, 'официальный_часовой_пояс');
    if (!timezoneRaw && stateTz) {
      timezoneRaw = String(stateTz).trim();
      if (!inheritedFromId) {
        inheritedFromId = cleanEntityId(resolvedState.id) || 'state';
        inheritedFromName = stateName ? `Государство «${stateName}»` : 'Государство';
      }
    }

    if (latitude === null && longitude === null && !isStateCapital) {
      const capitalEntity = findEntity(getEntityField(resolvedState, 'столица') ?? getEntityField(resolvedState, 'capital_id'));
      if (capitalEntity && cleanEntityId(capitalEntity.id) !== targetId) {
        const capLat = parseNumberOrNull(getEntityField(capitalEntity, 'широта') ?? getEntityField(capitalEntity, 'latitude'));
        const capLon = parseNumberOrNull(getEntityField(capitalEntity, 'долгота') ?? getEntityField(capitalEntity, 'longitude'));
        const capTz = String(getEntityField(capitalEntity, 'часовой_пояс') ?? getEntityField(capitalEntity, 'timezone') ?? '').trim();
        if (capLat !== null || capLon !== null || capTz) {
          latitude = capLat;
          longitude = capLon;
          if (!timezoneRaw && capTz) timezoneRaw = capTz;
          inheritedFromId = cleanEntityId(capitalEntity.id) || 'capital';
          inheritedFromName = `${getEntityName(capitalEntity) || 'Столица'} (столица)`;
        }
      }
    }
  }

  const ownLat = parseNumberOrNull(getEntityField(target, 'широта') ?? getEntityField(target, 'latitude'));
  const ownLon = parseNumberOrNull(getEntityField(target, 'долгота') ?? getEntityField(target, 'longitude'));
  const ownTz = String(getEntityField(target, 'часовой_пояс') ?? getEntityField(target, 'timezone') ?? getEntityField(target, 'timezone_id') ?? '').trim();
  const hasExplicitGeography = ownLat !== null || ownLon !== null || Boolean(ownTz);
  const tzInfo = parseTimezoneOffset(timezoneRaw, timezones, dayIndex, longitude);

  return {
    entityId: targetId,
    entityName: targetName,
    scale,
    buildingSubtype,
    latitude,
    longitude,
    timezoneRaw,
    timezoneId: tzInfo.timezoneId,
    offsetHours: tzInfo.offsetHours,
    hasExplicitGeography,
    isInherited: Boolean(inheritedFromId),
    inheritedFromId,
    inheritedFromName,
    planetId,
    climateZone,
    stateId: stateId ? cleanEntityId(stateId) || stateId : null,
    stateName,
    isStateCapital,
    officialCalendarId,
    breadcrumbs,
  };
}

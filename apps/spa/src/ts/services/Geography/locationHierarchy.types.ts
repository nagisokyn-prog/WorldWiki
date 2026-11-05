import type { RegionSunStatus } from '../Calendars/calendar.types';

export type LocationScale =
  | 'interior'
  | 'building'
  | 'district'
  | 'settlement'
  | 'region'
  | 'macro';

export type BuildingSubtype =
  | 'residential'
  | 'hospitality'
  | 'medical'
  | 'educational'
  | 'administrative'
  | 'military'
  | 'religious'
  | 'commercial'
  | 'industrial';

export type GeographyEntityRecord = Record<string, unknown>;

export interface LocationBreadcrumb {
  id: string;
  name: string;
  scale?: string;
}

export interface ResolvedLocationGeography {
  entityId: string;
  entityName: string;
  scale: string;
  buildingSubtype: string;
  latitude: number | null;
  longitude: number | null;
  timezoneRaw: string;
  timezoneId: string;
  offsetHours: number;
  hasExplicitGeography: boolean;
  isInherited: boolean;
  inheritedFromId: string | null;
  inheritedFromName: string | null;
  planetId: string | null;
  climateZone: string | null;
  stateId: string | null;
  stateName: string | null;
  isStateCapital: boolean;
  officialCalendarId: string | null;
  breadcrumbs: LocationBreadcrumb[];
}

export interface ComputedLocationTime {
  offsetHours: number;
  localTimeStr: string;
  localDateFormatted: string;
  worldTimeStr: string;
  sunStatus: RegionSunStatus;
  phaseEmoji: string;
  hasDiscrepancy: boolean;
  discrepancyHint: string | null;
}

export const LOCATION_SCALE_LABELS: Record<string, string> = {
  interior: '🚪 Интерьер / Помещение',
  building: '🏢 Здание / Заведение',
  district: '🏘️ Район / Квартал',
  settlement: '🏙️ Поселение / Город',
  region: '🗺️ Регион / Провинция',
  macro: '🪐 Макро-объект / Планета',
};

export const BUILDING_SUBTYPE_LABELS: Record<string, string> = {
  residential: '🏡 Жилое',
  hospitality: '🍺 Общепит / Ночлег',
  medical: '🏥 Медицинское',
  educational: '🎓 Образовательное',
  administrative: '🏛️ Административное',
  military: '⚔️ Военное / Оборонительное',
  religious: '⛪ Религиозное',
  commercial: '💰 Торговое',
  industrial: '⚒️ Производственное',
};


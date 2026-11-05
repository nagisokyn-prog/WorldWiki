import type { WorldTimezone } from '@/services/Calendars/calendar.types';
import type {
  ComputedLocationTime,
  ResolvedLocationGeography,
} from '@/services/Geography/locationHierarchy';

export interface LocationAstronomyWidgetProps {
  project: string;
  entityId?: string;
  formData: Record<string, unknown>;
}

export type LocationAstronomyWidgetEmits = {
  (e: 'apply-timezone', timezoneValue: string): void;
  (e: 'apply-coordinates', payload: { latitude: number; longitude: number }): void;
};

export interface LocationSeasonChip {
  name: string;
  icon: string;
  startDay: number;
}

export interface LocationAstronomyPreviewState {
  resolvedGeo: ResolvedLocationGeography;
  timeInfo: ComputedLocationTime;
  availableTimezones: WorldTimezone[];
  scaleLabel: string;
  formattedOffset: string;
  coordinatesLabel: string;
}


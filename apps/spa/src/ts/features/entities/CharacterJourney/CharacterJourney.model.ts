import type { Entity } from '@/types/generated/Entity';

export type JourneyFilterMode = 'union' | 'intersection' | 'single';

export type CharacterJourneyViewMode = 'BY_ARCS' | 'NARRATIVE' | 'CHRONOLOGY' | 'BY_CHAPTERS';

export interface JourneyMeetingGap {
  chapters_count: number;
  formatted_label: string;
  [key: string]: unknown;
}

export interface JourneyAppearance {
  chapter_id?: string;
  chapter_title?: string;
  chapter_order?: number;
  source?: string;
  role?: string;
  created_at?: string | number;
  [key: string]: unknown;
}

export interface JourneyEvent {
  event_id: string;
  event_title: string;
  event_desc?: string;
  m_abs: number;
  role?: string;
  [key: string]: unknown;
}

export interface JourneyRelation {
  id: string;
  target_name: string;
  rel_type: string;
  start_order?: number;
  strength?: number;
  [key: string]: unknown;
}

export interface JourneyPromise {
  id: string;
  kind?: string;
  quote?: string;
  title?: string;
  status?: string;
  chapter_id?: string;
  chapter_title?: string;
  planted_order?: number;
  paragraph_index?: number;
  block_id?: string;
  m_abs?: number;
  calendar_id?: string;
  date_fields?: Record<string, unknown>;
  timeline_event_id?: string;
  arc_id?: string;
  arc_title?: string;
  arc_color?: string;
  arc_phase?: string;
  arcs?: Array<string | { arc_id?: string; arc_phase?: string }>;
  [key: string]: unknown;
}

export interface CharacterJourneyData {
  entity?: Entity;
  attributes?: Record<string, unknown>;
  appearances?: JourneyAppearance[];
  events?: JourneyEvent[];
  relations?: JourneyRelation[];
  promises?: JourneyPromise[];
  [key: string]: unknown;
}

export interface MultiJourneySceneEntity {
  entity_id: string;
  entity_name: string;
  arcs?: Array<{
    arc_id?: string;
    arc_title?: string;
    color?: string;
    arc_phase?: string;
  }>;
  [key: string]: unknown;
}

export interface MultiJourneyScene {
  id: string;
  item_type?: string;
  chapter_id?: string;
  chapter_title?: string;
  sort_order: number;
  volume_title?: string;
  scene_date_formatted?: string;
  scene_m_abs?: number;
  present_entities: MultiJourneySceneEntity[];
  meeting_gap?: JourneyMeetingGap;
  [key: string]: unknown;
}

export interface MultiJourneyResponse {
  entities: Entity[];
  scenes: MultiJourneyScene[];
  timelines?: Record<string, CharacterJourneyData>;
  [key: string]: unknown;
}

export interface JourneyTimelineItem {
  id: string;
  type: 'appearance' | 'event' | 'relation_change' | 'promise';
  kind?: string;
  title: string;
  subtitle?: string;
  fullText?: string;
  description?: string;
  timeLabel?: string;
  phaseLabel?: string;
  chapter_id?: string;
  chapter_title?: string;
  chapter_order?: number;
  paragraph_index?: number;
  block_id?: string;
  m_abs?: number;
  birth_m_abs?: number | null;
  ageLabel?: string;
  isBeforeBirth?: boolean;
  calendar_id?: string;
  date_fields?: Record<string, unknown>;
  timeline_event_id?: string;
  arc_id?: string;
  arc_title?: string;
  arc_color?: string;
  arc_phase?: string;
  boundArcs?: Array<{
    arcId: string;
    arcTitle: string;
    arcColor?: string;
    phase: string;
    phaseLabel: string;
  }>;
  allArcIds?: string[];
  badge?: string;
  badgeType?: 'accent' | 'warning' | 'success' | 'danger' | 'muted';
  isFlashback?: boolean;
  flashbackDeltaLabel?: string;
  participants?: MultiJourneySceneEntity[];
  meetingGap?: JourneyMeetingGap;
  [key: string]: unknown;
}

export interface ArcGroup {
  arcId: string;
  arcTitle: string;
  arcColor?: string;
  items: JourneyTimelineItem[];
}

export interface CharacterJourneyProps {
  projectId?: string;
  entityId?: string;
}

export type CharacterJourneyEmits = {
  (e: 'select-scene', item: JourneyTimelineItem): void;
};

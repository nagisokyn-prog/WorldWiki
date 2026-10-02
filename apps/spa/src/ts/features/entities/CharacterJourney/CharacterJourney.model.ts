export interface JourneyAppearance {
  chapter_id: string;
  chapter_title: string;
  chapter_order: number;
  source: 'mention' | 'manual' | 'scene';
  role?: string | null;
  created_at?: string;
}

export interface JourneyEvent {
  event_id: string;
  event_title: string;
  event_desc?: string | null;
  m_abs: number;
  calendar_id?: string | null;
  role?: string | null;
}

export interface JourneyRelation {
  id: string;
  target_name: string;
  rel_type: string;
  strength?: number | null;
  start_order?: number | null;
  end_order?: number | null;
}

export interface JourneyPromise {
  id: string;
  kind: string;
  quote: string;
  status: 'planted' | 'developed' | 'resolved';
  planted_order?: number | null;
  resolved_order?: number | null;
  chapter_id?: string | null;
  chapter_title?: string | null;
  paragraph_index?: number | null;
  block_id?: string | null;
  arc_id?: string | null;
  arc_title?: string | null;
  arc_color?: string | null;
  arc_phase?: string | null;
  arcs?: unknown;
  m_abs?: number | null;
  calendar_id?: string | null;
  date_fields?: Record<string, unknown> | null;
  timeline_event_id?: string | null;
}

export interface CharacterJourneyData {
  entity_id?: string;
  entity_name?: string;
  entity_type?: string;
  attributes?: Record<string, unknown>;
  appearances: JourneyAppearance[];
  events: JourneyEvent[];
  relations: JourneyRelation[];
  promises: JourneyPromise[];
}

export type JourneyTimelineItemType = 'appearance' | 'event' | 'relation_change' | 'promise';

export type CharacterJourneyViewMode = 'BY_ARCS' | 'NARRATIVE' | 'CHRONOLOGY';

export interface JourneyTimelineItem {
  id: string;
  type: JourneyTimelineItemType;
  kind?: string;
  title: string;
  subtitle?: string;
  fullText?: string;
  timeLabel?: string;
  phaseLabel?: string;
  chapter_id?: string;
  chapter_title?: string;
  chapter_order?: number | null;
  paragraph_index?: number | null;
  block_id?: string | null;
  m_abs?: number | null;
  calendar_id?: string | null;
  date_fields?: Record<string, unknown> | null;
  timeline_event_id?: string | null;
  arc_id?: string | null;
  arc_title?: string | null;
  arc_color?: string | null;
  arc_phase?: string | null;
  boundArcs?: Array<{
    arcId: string;
    arcTitle: string;
    arcColor?: string;
    phase: string;
    phaseLabel: string;
  }>;
  allArcIds?: string[];
  badge?: string;
  badgeType?: 'accent' | 'warning' | 'success' | 'danger' | 'muted' | 'arc';
  description?: string;
  isFlashback?: boolean;
  flashbackDeltaLabel?: string;
  ageLabel?: string;
  isBeforeBirth?: boolean;
  birth_m_abs?: number | null;
  participants?: JourneyParticipant[];
  meetingGap?: JourneyMeetingGap | null;
}

export interface ArcGroup {
  arcId: string;
  arcTitle: string;
  arcColor?: string;
  items: JourneyTimelineItem[];
}

export type JourneyFilterMode = 'union' | 'intersection';

export interface JourneyParticipantArc {
  arc_id: string;
  arc_title: string;
  arc_phase?: string | null;
  color?: string | null;
}

export interface JourneyParticipant {
  entity_id: string;
  entity_name: string;
  role_in_story?: string | null;
  status_category?: string | null;
  age_label?: string | null;
  is_before_birth: boolean;
  is_deceased: boolean;
  arcs: JourneyParticipantArc[];
}

export interface JourneyMeetingGap {
  chapters_count: number;
  minutes_delta?: number | null;
  formatted_label: string;
}

export interface MultiJourneyScene {
  id: string;
  item_type: string;
  chapter_id?: string | null;
  chapter_title?: string | null;
  volume_title?: string | null;
  sort_order: number;
  scene_m_abs?: number | null;
  scene_date_formatted?: string | null;
  present_entities: JourneyParticipant[];
  meeting_gap?: JourneyMeetingGap | null;
}

export interface MultiJourneyResponse {
  total_scenes: number;
  filter_mode: JourneyFilterMode;
  requested_entity_ids: string[];
  scenes: MultiJourneyScene[];
}


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
  m_abs: number;
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
}

export interface CharacterJourneyData {
  entity?: {
    id: string;
    name: string;
    entity_type: string;
    attributes?: Record<string, unknown>;
  };
  appearances: JourneyAppearance[];
  events: JourneyEvent[];
  relations: JourneyRelation[];
  promises: JourneyPromise[];
}

export type JourneyTimelineItemType = 'appearance' | 'event' | 'relation_change' | 'promise';

export interface JourneyTimelineItem {
  id: string;
  type: JourneyTimelineItemType;
  title: string;
  subtitle?: string;
  chapter_order?: number | null;
  m_abs?: number | null;
  badge?: string;
  badgeType?: 'accent' | 'warning' | 'success' | 'danger' | 'muted';
  description?: string;
}

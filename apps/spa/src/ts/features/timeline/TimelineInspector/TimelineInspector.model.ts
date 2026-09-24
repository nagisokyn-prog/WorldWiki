export interface InspectorReveal {
  chapter_id: string;
  chapter_title: string;
  chapter_order: number;
  pov_id?: string | null;
  kind: 'direct' | 'flashback' | 'mention' | 'rumor';
  block_id?: string | null;
}

export interface InspectorParticipant {
  id: string;
  name: string;
  entity_type: string;
}

export interface InspectorEvent {
  id: string;
  title: string;
  description?: string | null;
  m_abs: number;
  calendar_id?: string;
  reveals: InspectorReveal[];
  participants: InspectorParticipant[];
}

export interface InspectorChapter {
  id: string;
  title: string;
  sort_order: number;
}

export interface TimelineInspectorData {
  events: InspectorEvent[];
  chapters: InspectorChapter[];
}

export interface TimelineInspectorFilterState {
  searchQuery: string;
  selectedEntityId: string;
  selectedPovId: string;
  readerHorizonChapterOrder: number | null; // null = Author / God mode; number = Reader Mode up to chapter N
  showFlashbacksOnly: boolean;
}

export interface VisualizedConnectionLine {
  id: string;
  eventId: string;
  chapterId: string;
  eventTitle: string;
  chapterTitle: string;
  chapterOrder: number;
  m_abs: number;
  kind: string;
  isFlashback: boolean;
  x1: number; // chapter X on narrative axis
  y1: number; // chapter Y
  x2: number; // event X on diegetic axis
  y2: number; // event Y
}

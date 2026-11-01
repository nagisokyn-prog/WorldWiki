export interface InspectorReveal {
  chapter_id: string;
  chapter_title: string;
  chapter_order?: number;
  chapter_sort_order?: number;
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
  id?: string;
  event_id?: string;
  title: string;
  description?: string | null;
  m_abs: number;
  calendar_id?: string;
  reveals: InspectorReveal[];
  participants: InspectorParticipant[];
  kind?: string;
  location_id?: string | null;
}

export interface InspectorKindMeta {
  label: string;
  icon: string;
  badgeClass: string;
}

export function getInspectorKindMeta(kind?: string): InspectorKindMeta {
  switch (kind) {
    case 'conflict':
      return { label: 'Конфликт', icon: '⚔️', badgeClass: 'badge-conflict' };
    case 'gun':
      return { label: 'Чеховское ружьё', icon: '🔫', badgeClass: 'badge-gun' };
    case 'foreshadowing':
      return { label: 'Предзнаменование', icon: '🔮', badgeClass: 'badge-foreshadowing' };
    case 'mystery':
      return { label: 'Загадка', icon: '❓', badgeClass: 'badge-mystery' };
    case 'question':
      return { label: 'Вопрос', icon: '💭', badgeClass: 'badge-question' };
    case 'event':
      return { label: 'Событие мира', icon: '⏳', badgeClass: 'badge-event' };
    case 'scene':
    default:
      return { label: 'Сцена', icon: '🎬', badgeClass: 'badge-scene' };
  }
}

export interface FormattedInspectorEvent extends InspectorEvent {
  id: string;
  formattedDate: string;
  cleanParticipants: InspectorParticipant[];
  isScene: boolean;
  kindMeta: InspectorKindMeta;
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

export interface TimelineInspectorProps {
  projectId?: string;
  project?: string;
}

export interface TimelineInspectorEmits {
  (e: 'open-chapter', chapter: { id: string; title: string } | string): void;
}

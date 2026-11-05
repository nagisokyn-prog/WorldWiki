export type { StoryArc } from '@/stores/story_arcs.store';

export type ArcStatus = 'planned' | 'in_progress' | 'completed' | 'abandoned';
export type ArcType = 'character' | 'event' | 'relationship' | 'theme';

export interface ArcColumnConfig {
  status: ArcStatus;
  title: string;
  badgeType: 'muted' | 'accent' | 'success' | 'danger';
}

export interface ArcBoardFilterState {
  searchQuery: string;
  selectedType: string;
}

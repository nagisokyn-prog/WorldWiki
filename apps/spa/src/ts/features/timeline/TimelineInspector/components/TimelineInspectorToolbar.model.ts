import type { TimelineInspectorFilterState, InspectorChapter } from '../TimelineInspector.model';

export interface TimelineInspectorToolbarProps {
  filters: TimelineInspectorFilterState;
  filteredEventsCount: number;
  filteredChaptersCount: number;
  filteredChapters: InspectorChapter[];
  isLoading: boolean;
}

export type TimelineInspectorToolbarEmits = {
  (e: 'refresh'): void;
};

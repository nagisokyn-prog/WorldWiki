import type { TimelineEvent } from './useTimelinePanel';

export interface TimelinePanelProps {
  project: string;
  events?: TimelineEvent[];
}

export type TimelinePanelEmits = {
  (e: 'update:events', events: TimelineEvent[]): void;
  (e: 'change'): void;
};

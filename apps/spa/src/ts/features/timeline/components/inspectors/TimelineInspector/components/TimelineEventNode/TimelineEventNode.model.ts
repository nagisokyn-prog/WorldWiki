import type { FormattedInspectorEvent } from '../../TimelineInspector.model';

export interface TimelineEventNodeProps {
  ev: FormattedInspectorEvent;
  pingedEventId: string | null;
  isHighlighted: (ev: FormattedInspectorEvent) => boolean;
  isDimmed: (ev: FormattedInspectorEvent) => boolean;
}

export type TimelineEventNodeEmits = {
  (e: 'hover-event', id: string | null): void;
  (e: 'navigate-scene', ev: FormattedInspectorEvent): void;
  (e: 'scroll-chapter', chapterId: string): void;
  (e: 'scroll-event', eventId: string): void;
};

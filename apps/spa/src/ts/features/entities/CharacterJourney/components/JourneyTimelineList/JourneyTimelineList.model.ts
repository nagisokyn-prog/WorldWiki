import type { JourneyTimelineItem } from '../../CharacterJourney.model'

export interface JourneyTimelineListProps {
  timelineItems: JourneyTimelineItem[];
}

export type JourneyTimelineListEmits = {
  (e: 'select-scene', item: JourneyTimelineItem): void;
};

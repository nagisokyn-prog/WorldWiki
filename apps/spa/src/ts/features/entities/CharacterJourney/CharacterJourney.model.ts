import type { JourneyTimelineItem } from './CharacterJourney.model'

export interface CharacterJourneyProps {
  projectId?: string;
      entityId?: string;
}

export type CharacterJourneyEmits = {
  (e: 'select-scene', item: JourneyTimelineItem): void;
};

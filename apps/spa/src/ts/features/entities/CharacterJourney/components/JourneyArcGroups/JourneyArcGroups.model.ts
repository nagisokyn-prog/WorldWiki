import type { Entity } from '@/types/generated/Entity'
import type { ArcGroup, JourneyTimelineItem } from '../../CharacterJourney.model'

export interface JourneyArcGroupsProps {
  arcGroups: ArcGroup[];
    currentEntity?: Entity | null;
    selectedEntities?: Entity[];
}

export type JourneyArcGroupsEmits = {
  (e: 'select-scene', item: JourneyTimelineItem): void;
};

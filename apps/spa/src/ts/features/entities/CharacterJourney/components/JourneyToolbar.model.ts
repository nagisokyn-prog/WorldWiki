import type { Entity } from '@/types/generated/Entity'
import type { StoryArc } from '@/stores/story_arcs.store'
import type { CharacterJourneyViewMode, JourneyFilterMode } from '../CharacterJourney.model'

export interface JourneyToolbarProps {
  selectedEntities: Entity[];
    entitiesList: Entity[];
    viewMode: CharacterJourneyViewMode;
    selectedArcFilter: string;
    filterType: string;
    filterMode: JourneyFilterMode;
    storyArcs: StoryArc[];
    isLoading: boolean;
}

export type JourneyToolbarEmits = {
  (e: 'add-entity', val: string): void;
    (e: 'remove-entity', val: string): void;
    (e: 'update:filterMode', val: JourneyFilterMode): void;
    (e: 'update:filter-mode', val: JourneyFilterMode): void;
    (e: 'update:viewMode', val: CharacterJourneyViewMode): void;
    (e: 'update:selectedArcFilter', val: string): void;
    (e: 'update:filterType', val: string): void;
    (e: 'refresh'): void;
};

import { getCharacterJourney, getMultiCharacterJourney } from '@/services/api.client';
import type { Entity } from '@/types/generated/Entity';
import type {
  CharacterJourneyData,
  JourneyAppearance,
  JourneyFilterMode,
  MultiJourneyResponse,
} from '../CharacterJourney.model';
import {
  enrichJourneyAppearances,
  enrichMultiJourneyScenes,
  enrichJourneyEvents,
} from './useJourneyManuscriptEnricher';

function resolveEntityMeta(
  entityId: string,
  entitiesList: Entity[],
  fallbackName?: string,
  fallbackAttrs?: Record<string, unknown>
): { entityName: string; aliases: string[] } {
  const cleanId = entityId.replace(/^entities:/, '');
  const activeEntity = entitiesList.find((e) => (e.id || '').replace(/^entities:/, '') === cleanId);
  const entityName = activeEntity?.name || fallbackName || '';
  const aliases =
    (activeEntity?.attributes?.aliases as string[]) ||
    (fallbackAttrs?.aliases as string[]) ||
    [];
  return { entityName, aliases };
}

export async function fetchAndEnrichMultiJourney(
  projectId: string,
  entityIds: string[],
  filterMode: JourneyFilterMode,
  entitiesList: Entity[]
): Promise<MultiJourneyResponse> {
  const [rawMulti, ...individualJourneys] = await Promise.all([
    getMultiCharacterJourney(projectId, entityIds, filterMode),
    ...entityIds.map((id) => Promise.resolve(getCharacterJourney(projectId, id)).catch(() => null)),
  ]);

  const resolvedMulti = (rawMulti as MultiJourneyResponse) || { entities: [], scenes: [] };
  if (resolvedMulti.scenes && resolvedMulti.scenes.length > 0) {
    resolvedMulti.scenes = await enrichMultiJourneyScenes(projectId, resolvedMulti.scenes);
  }

  const combinedAppearances: JourneyAppearance[] = [];
  for (let i = 0; i < entityIds.length; i++) {
    const singleId = entityIds[i];
    const rawSingle = individualJourneys[i] as (CharacterJourneyData & { entity_name?: string }) | null;
    if (rawSingle?.appearances && rawSingle.appearances.length > 0) {
      const { entityName, aliases } = resolveEntityMeta(
        singleId,
        entitiesList,
        rawSingle.entity?.name || rawSingle.entity_name,
        rawSingle.attributes
      );
      const enriched = await enrichJourneyAppearances(
        projectId,
        rawSingle.appearances,
        singleId,
        entityName,
        aliases,
        rawSingle.promises || []
      );
      for (const app of enriched) {
        combinedAppearances.push({ ...app, entity_id: singleId, entity_name: entityName });
      }
    }
  }

  resolvedMulti.appearances = combinedAppearances;
  return resolvedMulti;
}

export async function fetchAndEnrichSingleJourney(
  projectId: string,
  singleId: string,
  entitiesList: Entity[]
): Promise<CharacterJourneyData> {
  const raw = await getCharacterJourney(projectId, singleId);
  const resolvedData = (raw as CharacterJourneyData) || {
    appearances: [],
    events: [],
    relations: [],
    promises: [],
  };

  const { entityName, aliases } = resolveEntityMeta(
    singleId,
    entitiesList,
    resolvedData.entity?.name,
    resolvedData.attributes
  );

  if (resolvedData.appearances && resolvedData.appearances.length > 0) {
    resolvedData.appearances = await enrichJourneyAppearances(
      projectId,
      resolvedData.appearances,
      singleId,
      entityName,
      aliases,
      resolvedData.promises || []
    );
  }

  if (resolvedData.events && resolvedData.events.length > 0) {
    resolvedData.events = await enrichJourneyEvents(projectId, resolvedData.events);
  }

  return resolvedData;
}


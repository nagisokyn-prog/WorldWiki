import { invoke } from '@tauri-apps/api/core';
import type { Entity, EntityRel, EntitySchema, RelationSchema } from './types';

export async function getEntities(project: string, entityType: string | null): Promise<Entity[]> {
  return await invoke('get_entities', { project, entityType });
}

export async function getEntitiesBatch(project: string, entityTypes: string[]): Promise<Record<string, Entity[]>> {
  return await invoke('get_entities_batch', { project, entityTypes });
}

export async function getEntity(id: string): Promise<Entity | null> {
  return await invoke('get_entity', { id });
}

export async function saveEntity(project: string, entity: Entity): Promise<Entity> {
  return await invoke('save_entity', { project, entity });
}

export async function saveEntityWithRelations(project: string, entity: Entity, foreignUpdates: Entity[]): Promise<Entity> {
  return await invoke('save_entity_with_relations', { project, entity, foreignUpdates });
}

export async function deleteEntity(id: string): Promise<void> {
  return await invoke('delete_entity', { id });
}

export async function searchEntities(project: string, query: string, entityType: string | null): Promise<Entity[]> {
  return await invoke('search_entities', { project, query, entityType });
}

export async function getEntitySchemas(project: string): Promise<EntitySchema[]> {
  return await invoke('get_entity_schemas', { project });
}

export async function saveEntitySchema(project: string, schema: EntitySchema, maxSaves: number | null): Promise<EntitySchema> {
  return await invoke('save_entity_schema', { project, schema, maxSaves });
}

export async function deleteEntitySchema(project: string, typeKey: string): Promise<void> {
  return await invoke('delete_entity_schema', { project, typeKey });
}

export async function getSchemaHistory(project: string, typeKey: string): Promise<Record<string, unknown>[]> {
  return await invoke('get_schema_history', { project, typeKey });
}

export async function toggleSchemaHistoryPin(historyId: string, isPinned: boolean): Promise<void> {
  return await invoke('toggle_schema_history_pin', { historyId, isPinned });
}

export async function toggleEntityHistoryPin(historyId: string, isPinned: boolean): Promise<void> {
  return await invoke('toggle_entity_history_pin', { historyId, isPinned });
}

export async function toggleChapterHistoryPin(historyId: string, isPinned: boolean): Promise<void> {
  return await invoke('toggle_chapter_history_pin', { historyId, isPinned });
}

export async function getEntityRelations(project: string, entityId: string | null): Promise<EntityRel[]> {
  return await invoke('get_entity_relations', { project, entityId });
}

export async function createEntityRelation(project: string, fromId: string, toId: string, rel: EntityRel): Promise<EntityRel> {
  return await invoke('create_entity_relation', { project, fromId, toId, rel });
}

export async function deleteEntityRelation(id: string): Promise<void> {
  return await invoke('delete_entity_relation', { id });
}

export async function getRelationSchemas(project: string): Promise<RelationSchema[]> {
  return await invoke('get_relation_schemas', { project });
}

export async function saveRelationSchema(project: string, schema: RelationSchema): Promise<RelationSchema> {
  return await invoke('save_relation_schema', { project, schema });
}

export async function deleteRelationSchema(project: string, relKey: string): Promise<void> {
  return await invoke('delete_relation_schema', { project, relKey });
}

export async function getEntityRevisions(project: string, entityId: string): Promise<Record<string, unknown>[]> {
  return await invoke('get_entity_revisions', { project, entityId });
}

export async function getEntityFullCard(entityId: string): Promise<unknown> {
  return await invoke('get_entity_full_card', { entityId });
}

export async function addEntityRelation(relation: unknown): Promise<void> {
  return await invoke('add_entity_relation', { relation });
}

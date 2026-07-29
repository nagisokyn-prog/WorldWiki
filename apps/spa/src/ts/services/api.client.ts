/**
 * @file api.client.ts
 * @description Автоматически сгенерированный клиент для Tauri invoke.
 * НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ! Запустите `node scripts/codegen.js` для обновления.
 */
import { invoke } from '@tauri-apps/api/core';
export interface SearchResult<T> { entity: T; score: number; kind: string; }
import type { Entity } from '../types/generated/Entity';
import type { EntitySchema } from '../types/generated/EntitySchema';
import type { EntityRel } from '../types/generated/EntityRel';
import type { RelationSchema } from '../types/generated/RelationSchema';
import type { Chapter } from '../types/generated/Chapter';
import type { Volume } from '../types/generated/Volume';
import type { Arc } from '../types/generated/Arc';
import type { Plan } from '../types/generated/Plan';
import type { Tag } from '../types/generated/Tag';
import type { Calendar } from '../types/generated/Calendar';
import type { TextBlock } from '../types/generated/TextBlock';
import type { ChatMessage } from '../types/generated/ChatMessage';
import type { AgentMemory } from '../types/generated/AgentMemory';
import type { WebCache } from '../types/generated/WebCache';
import type { Cites } from '../types/generated/Cites';

// --- Normal Commands ---
export async function getProjects(): Promise<any[]> {
    return await invoke('get_projects');
}

export async function createProject(projectData: any): Promise<string> {
    return await invoke('create_project', { projectData });
}

export async function getProjectConfig(name: string): Promise<any> {
    return await invoke('get_project_config', { name });
}

export async function saveProjectConfig(name: string, config: any): Promise<any> {
    return await invoke('save_project_config', { name, config });
}

export async function deleteProject(name: string): Promise<string> {
    return await invoke('delete_project', { name });
}

export async function getEntities(project: string, entityType: string | null): Promise<Entity[]> {
    return await invoke('get_entities', { project, 'entity_type': entityType });
}

export async function getEntitiesBatch(project: string, entityTypes: string[]): Promise<Record<string, any>> {
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
    return await invoke('search_entities', { project, query, 'entity_type': entityType });
}

export async function getEntitySchemas(project: string): Promise<EntitySchema[]> {
    return await invoke('get_entity_schemas', { project });
}

export async function saveEntitySchema(project: string, schema: EntitySchema, maxSaves: number | null): Promise<EntitySchema> {
    return await invoke('save_entity_schema', { project, schema, 'max_saves': maxSaves });
}

export async function deleteEntitySchema(project: string, typeKey: string): Promise<void> {
    return await invoke('delete_entity_schema', { project, 'type_key': typeKey });
}

export async function getSchemaHistory(project: string, typeKey: string): Promise<any[]> {
    return await invoke('get_schema_history', { project, 'type_key': typeKey });
}

export async function toggleSchemaHistoryPin(historyId: string, isPinned: boolean): Promise<void> {
    return await invoke('toggle_schema_history_pin', { 'history_id': historyId, 'is_pinned': isPinned });
}

export async function toggleEntityHistoryPin(historyId: string, isPinned: boolean): Promise<void> {
    return await invoke('toggle_entity_history_pin', { 'history_id': historyId, 'is_pinned': isPinned });
}

export async function toggleChapterHistoryPin(historyId: string, isPinned: boolean): Promise<void> {
    return await invoke('toggle_chapter_history_pin', { 'history_id': historyId, 'is_pinned': isPinned });
}

export async function getEntityRelations(project: string, entityId: string | null): Promise<EntityRel[]> {
    return await invoke('get_entity_relations', { project, 'entity_id': entityId });
}

export async function createEntityRelation(project: string, fromId: string, toId: string, rel: EntityRel): Promise<EntityRel> {
    return await invoke('create_entity_relation', { project, 'from_id': fromId, 'to_id': toId, rel });
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
    return await invoke('delete_relation_schema', { project, 'rel_key': relKey });
}

export async function uploadPhoto(bytes: number[], filename: string): Promise<string> {
    return await invoke('upload_photo', { bytes, filename });
}

export async function copyBackgroundFile(sourcePath: string): Promise<string> {
    return await invoke('copy_background_file', { 'source_path': sourcePath });
}

export async function getLocalFile(path: string): Promise<number[]> {
    return await invoke('get_local_file', { path });
}

export async function runPerformanceBenchmark(): Promise<any> {
    return await invoke('run_performance_benchmark');
}

export async function getPerformanceStyles(level: string): Promise<string> {
    return await invoke('get_performance_styles', { level });
}

export async function saveSettings(settings: any): Promise<void> {
    return await invoke('save_settings', { settings });
}

export async function loadSettings(): Promise<any> {
    return await invoke('load_settings');
}

export async function toggleFullscreen(): Promise<void> {
    return await invoke('toggle_fullscreen');
}

export async function getCustomThemes(): Promise<string[]> {
    return await invoke('get_custom_themes');
}

export async function loadTheme(theme: string): Promise<any> {
    return await invoke('load_theme', { theme });
}

export async function saveCustomTheme(name: string, settings: any): Promise<void> {
    return await invoke('save_custom_theme', { name, settings });
}

export async function getChapterHierarchy(project: string): Promise<any> {
    return await invoke('get_chapter_hierarchy', { project });
}

export async function createVolume(project: string, title: string): Promise<any> {
    return await invoke('create_volume', { project, title });
}

export async function updateVolume(Project: string, id: string, title: string): Promise<void> {
    return await invoke('update_volume', { '_project': Project, id, title });
}

export async function createArc(project: string, title: string, volumeId: string | null): Promise<any> {
    return await invoke('create_arc', { project, title, 'volume_id': volumeId });
}

export async function updateArc(Project: string, id: string, title: string, VolumeId: string | null): Promise<void> {
    return await invoke('update_arc', { '_project': Project, id, title, '_volume_id': VolumeId });
}

export async function assignChapter(project: string, chapterId: string, arcId: string | null, volumeId: string | null): Promise<void> {
    return await invoke('assign_chapter', { project, 'chapter_id': chapterId, 'arc_id': arcId, 'volume_id': volumeId });
}

export async function reorderNode(project: string, nodeType: string, id: string, sortOrder: number): Promise<void> {
    return await invoke('reorder_node', { project, 'node_type': nodeType, id, 'sort_order': sortOrder });
}

export async function getConnections(project: string, chapter: string | null): Promise<any> {
    return await invoke('get_connections', { project, chapter });
}

export async function saveConnections(project: string, sourceId: string, data: any): Promise<void> {
    return await invoke('save_connections', { project, 'source_id': sourceId, data });
}

export async function upsertConnectionsBatch(project: string, SourceType: string, sourceId: string, connections: EntityRel[]): Promise<void> {
    return await invoke('upsert_connections_batch', { project, '_source_type': SourceType, 'source_id': sourceId, connections });
}

export async function removeConnectionsBySource(Project: string, EType: string, eId: string): Promise<number> {
    return await invoke('remove_connections_by_source', { '_project': Project, '_e_type': EType, 'e_id': eId });
}

export async function getGlobalTimeline(project: string): Promise<any> {
    return await invoke('get_global_timeline', { project });
}

export async function exportChapters(project: string, chapters: any[], format: string): Promise<string> {
    return await invoke('export_chapters', { project, chapters, format });
}

export async function createCloudBackup(): Promise<string> {
    return await invoke('create_cloud_backup');
}

export async function exchangeYandexToken(code: string): Promise<string> {
    return await invoke('exchange_yandex_token', { code });
}

export async function uploadToYandexDisk(token: string, filePath: string): Promise<void> {
    return await invoke('upload_to_yandex_disk', { token, 'file_path': filePath });
}

export async function getLaunchArgs(): Promise<string | null> {
    return await invoke('get_launch_args');
}

export async function restoreFromBackup(backupPath: string): Promise<void> {
    return await invoke('restore_from_backup', { 'backup_path': backupPath });
}

export async function getChapterRevisions(project: string, chapterId: string): Promise<any[]> {
    return await invoke('get_chapter_revisions', { project, 'chapter_id': chapterId });
}

export async function getEntityRevisions(project: string, entityId: string): Promise<any[]> {
    return await invoke('get_entity_revisions', { project, 'entity_id': entityId });
}

export async function convertAbsoluteToLocal(absoluteMinute: number, calendar: any, eraIndex: number): Promise<any> {
    return await invoke('convert_absolute_to_local', { 'absolute_minute': absoluteMinute, calendar, 'era_index': eraIndex });
}

export async function saveTextBlocks(project: string, chapterId: string, blocks: any[]): Promise<void> {
    return await invoke('save_text_blocks', { project, 'chapter_id': chapterId, blocks });
}

// --- Entities CRUD ---
export async function getChapters(projectId: string): Promise<Chapter[]> {
    return await invoke('get_chapters', { 'project_id': projectId });
}

export async function getChapter(id: string): Promise<Chapter | null> {
    return await invoke('get_chapter', { id });
}

export async function saveChapter(data: Chapter): Promise<Chapter> {
    return await invoke('save_chapter', { data });
}

export async function deleteChapter(id: string): Promise<void> {
    return await invoke('delete_chapter', { id });
}

export async function getVolumes(projectId: string): Promise<Volume[]> {
    return await invoke('get_volumes', { 'project_id': projectId });
}

export async function getVolume(id: string): Promise<Volume | null> {
    return await invoke('get_volume', { id });
}

export async function saveVolume(data: Volume): Promise<Volume> {
    return await invoke('save_volume', { data });
}

export async function deleteVolume(id: string): Promise<void> {
    return await invoke('delete_volume', { id });
}

export async function getArcs(projectId: string): Promise<Arc[]> {
    return await invoke('get_arcs', { 'project_id': projectId });
}

export async function getArc(id: string): Promise<Arc | null> {
    return await invoke('get_arc', { id });
}

export async function saveArc(data: Arc): Promise<Arc> {
    return await invoke('save_arc', { data });
}

export async function deleteArc(id: string): Promise<void> {
    return await invoke('delete_arc', { id });
}

export async function getPlans(projectId: string): Promise<Plan[]> {
    return await invoke('get_plans', { 'project_id': projectId });
}

export async function getPlan(id: string): Promise<Plan | null> {
    return await invoke('get_plan', { id });
}

export async function savePlan(data: Plan): Promise<Plan> {
    return await invoke('save_plan', { data });
}

export async function deletePlan(id: string): Promise<void> {
    return await invoke('delete_plan', { id });
}

export async function getTags(projectId: string): Promise<Tag[]> {
    return await invoke('get_tags', { 'project_id': projectId });
}

export async function getTag(id: string): Promise<Tag | null> {
    return await invoke('get_tag', { id });
}

export async function saveTag(data: Tag): Promise<Tag> {
    return await invoke('save_tag', { data });
}

export async function deleteTag(id: string): Promise<void> {
    return await invoke('delete_tag', { id });
}

export async function getCalendars(project: string): Promise<Calendar[]> {
    return await invoke('get_calendars', { project });
}

export async function getCalendar(id: string): Promise<Calendar | null> {
    return await invoke('get_calendar', { id });
}

export async function saveCalendar(data: Calendar): Promise<Calendar> {
    return await invoke('save_calendar', { data });
}

export async function deleteCalendar(id: string): Promise<void> {
    return await invoke('delete_calendar', { id });
}

export async function getTextblocks(projectId: string): Promise<TextBlock[]> {
    return await invoke('get_textblocks', { 'project_id': projectId });
}

export async function getTextblock(id: string): Promise<TextBlock | null> {
    return await invoke('get_textblock', { id });
}

export async function saveTextblock(data: TextBlock): Promise<TextBlock> {
    return await invoke('save_textblock', { data });
}

export async function deleteTextblock(id: string): Promise<void> {
    return await invoke('delete_textblock', { id });
}

export async function searchTextblocks(projectId: string, query: string): Promise<SearchResult<TextBlock>[]> {
    return await invoke('search_textblocks', { 'project_id': projectId, query });
}

export async function getChatmessages(projectId: string): Promise<ChatMessage[]> {
    return await invoke('get_chatmessages', { 'project_id': projectId });
}

export async function getChatmessage(id: string): Promise<ChatMessage | null> {
    return await invoke('get_chatmessage', { id });
}

export async function saveChatmessage(data: ChatMessage): Promise<ChatMessage> {
    return await invoke('save_chatmessage', { data });
}

export async function deleteChatmessage(id: string): Promise<void> {
    return await invoke('delete_chatmessage', { id });
}

export async function searchChatmessages(projectId: string, query: string): Promise<SearchResult<ChatMessage>[]> {
    return await invoke('search_chatmessages', { 'project_id': projectId, query });
}

export async function getAgentmemorys(projectId: string): Promise<AgentMemory[]> {
    return await invoke('get_agentmemorys', { 'project_id': projectId });
}

export async function getAgentmemory(id: string): Promise<AgentMemory | null> {
    return await invoke('get_agentmemory', { id });
}

export async function saveAgentmemory(data: AgentMemory): Promise<AgentMemory> {
    return await invoke('save_agentmemory', { data });
}

export async function deleteAgentmemory(id: string): Promise<void> {
    return await invoke('delete_agentmemory', { id });
}

export async function searchAgentmemorys(projectId: string, query: string): Promise<SearchResult<AgentMemory>[]> {
    return await invoke('search_agentmemorys', { 'project_id': projectId, query });
}

export async function getWebcaches(projectId: string): Promise<WebCache[]> {
    return await invoke('get_webcaches', { 'project_id': projectId });
}

export async function getWebcache(id: string): Promise<WebCache | null> {
    return await invoke('get_webcache', { id });
}

export async function saveWebcache(data: WebCache): Promise<WebCache> {
    return await invoke('save_webcache', { data });
}

export async function deleteWebcache(id: string): Promise<void> {
    return await invoke('delete_webcache', { id });
}

export async function searchWebcaches(projectId: string, query: string): Promise<SearchResult<WebCache>[]> {
    return await invoke('search_webcaches', { 'project_id': projectId, query });
}

// --- Relations CRUD ---
export async function getCites(projectId: string, sourceId: string): Promise<Cites[]> {
    return await invoke('get_cites', { 'project_id': projectId, 'source_id': sourceId });
}

export async function createCite(data: Cites): Promise<Cites> {
    return await invoke('create_cite', { data });
}

export async function deleteCite(id: string): Promise<void> {
    return await invoke('delete_cite', { id });
}

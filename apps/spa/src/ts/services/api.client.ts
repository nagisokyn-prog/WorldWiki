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
export async function getProjects(): Promise<Record<string, unknown>[]> {
    return await invoke('get_projects');
}

export async function createProject(projectData: Record<string, unknown>): Promise<string> {
    return await invoke('create_project', { projectData });
}

export async function getProjectConfig(name: string): Promise<Record<string, unknown>> {
    return await invoke('get_project_config', { name });
}

export async function saveProjectConfig(name: string, config: Record<string, unknown>): Promise<{ success: boolean }> {
    return await invoke('save_project_config', { name, config });
}

export async function deleteProject(name: string): Promise<string> {
    return await invoke('delete_project', { name });
}

export async function getEntities(project: string, entityType: string | null): Promise<Entity[]> {
    return await invoke('get_entities', { project, entityType });
}

export async function getEntitiesBatch(project: string, entityTypes: string[]): Promise<Record<string, Record<string, unknown>[]>> {
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

export async function uploadPhoto(bytes: number[], filename: string): Promise<string> {
    return await invoke('upload_photo', { bytes, filename });
}

export async function copyBackgroundFile(sourcePath: string): Promise<string> {
    return await invoke('copy_background_file', { sourcePath });
}

export async function getLocalFile(path: string): Promise<number[]> {
    return await invoke('get_local_file', { path });
}

export async function runPerformanceBenchmark(): Promise<Record<string, unknown>> {
    return await invoke('run_performance_benchmark');
}

export async function getPerformanceStyles(level: string): Promise<string> {
    return await invoke('get_performance_styles', { level });
}

export async function saveSettings(settings: Record<string, unknown>): Promise<void> {
    return await invoke('save_settings', { settings });
}

export async function loadSettings(): Promise<Record<string, unknown>> {
    return await invoke('load_settings');
}

export async function toggleFullscreen(): Promise<void> {
    return await invoke('toggle_fullscreen');
}

export async function getCustomThemes(): Promise<string[]> {
    return await invoke('get_custom_themes');
}

export async function loadTheme(theme: string): Promise<Record<string, unknown>> {
    return await invoke('load_theme', { theme });
}

export async function saveCustomTheme(name: string, settings: Record<string, unknown>): Promise<void> {
    return await invoke('save_custom_theme', { name, settings });
}

export async function getChapterHierarchy(project: string): Promise<Record<string, unknown>> {
    return await invoke('get_chapter_hierarchy', { project });
}

export async function createVolume(project: string, title: string): Promise<Record<string, unknown>> {
    return await invoke('create_volume', { project, title });
}

export async function updateVolume(Project: string, id: string, title: string): Promise<void> {
    return await invoke('update_volume', { Project, id, title });
}

export async function createArc(project: string, title: string, volumeId: string | null): Promise<Record<string, unknown>> {
    return await invoke('create_arc', { project, title, volumeId });
}

export async function updateArc(Project: string, id: string, title: string, VolumeId: string | null): Promise<void> {
    return await invoke('update_arc', { Project, id, title, VolumeId });
}

export async function assignChapter(project: string, chapterId: string, arcId: string | null, volumeId: string | null): Promise<void> {
    return await invoke('assign_chapter', { project, chapterId, arcId, volumeId });
}

export async function reorderNode(project: string, nodeType: string, id: string, sortOrder: number): Promise<void> {
    return await invoke('reorder_node', { project, nodeType, id, sortOrder });
}

export async function getConnections(project: string, chapter: string | null): Promise<Record<string, unknown>[]> {
    return await invoke('get_connections', { project, chapter });
}

export async function saveConnections(project: string, sourceId: string, data: unknown): Promise<void> {
    return await invoke('save_connections', { project, sourceId, data });
}

export async function upsertConnectionsBatch(project: string, SourceType: string, sourceId: string, connections: EntityRel[]): Promise<void> {
    return await invoke('upsert_connections_batch', { project, SourceType, sourceId, connections });
}

export async function removeConnectionsBySource(Project: string, EType: string, eId: string): Promise<number> {
    return await invoke('remove_connections_by_source', { Project, EType, eId });
}

export async function getGlobalTimeline(project: string): Promise<Record<string, unknown>> {
    return await invoke('get_global_timeline', { project });
}

export async function exportChapters(project: string, chapters: Array<Record<string, unknown>>, format: string): Promise<string> {
    return await invoke('export_chapters', { project, chapters, format });
}

export async function createCloudBackup(): Promise<string> {
    return await invoke('create_cloud_backup');
}

export async function exchangeYandexToken(code: string): Promise<string> {
    return await invoke('exchange_yandex_token', { code });
}

export async function uploadToYandexDisk(token: string, filePath: string): Promise<void> {
    return await invoke('upload_to_yandex_disk', { token, filePath });
}

export async function listYandexDiskBackups(token: string): Promise<Record<string, unknown>[]> {
    return await invoke('list_yandex_disk_backups', { token });
}

export async function downloadAndRestoreYandex(token: string, fileName: string): Promise<void> {
    return await invoke('download_and_restore_yandex', { token, fileName });
}

export async function getLaunchArgs(): Promise<string | null> {
    return await invoke('get_launch_args');
}

export async function restoreFromBackup(backupPath: string): Promise<void> {
    return await invoke('restore_from_backup', { backupPath });
}

export async function getChapterRevisions(project: string, chapterId: string): Promise<Record<string, unknown>[]> {
    return await invoke('get_chapter_revisions', { project, chapterId });
}

export async function getEntityRevisions(project: string, entityId: string): Promise<Record<string, unknown>[]> {
    return await invoke('get_entity_revisions', { project, entityId });
}

export async function convertAbsoluteToLocal(absoluteMinute: number, calendar: Record<string, unknown>, eraIndex: number): Promise<Record<string, unknown>> {
    return await invoke('convert_absolute_to_local', { absoluteMinute, calendar, eraIndex });
}

export async function saveTextBlocks(project: string, chapterId: string, html: string): Promise<void> {
    return await invoke('save_text_blocks', { project, chapterId, html });
}

// --- Entities CRUD ---
export async function getChapters(project: string): Promise<Chapter[]> {
    return await invoke('get_chapters', { project });
}

export async function getChapter(id: string): Promise<Chapter | null> {
    return await invoke('get_chapter', { id });
}

export async function saveChapter(project: string, data: Chapter): Promise<Chapter> {
    return await invoke('save_chapter', { project, data });
}

export async function deleteChapter(id: string): Promise<void> {
    return await invoke('delete_chapter', { id });
}

export async function getVolumes(project: string): Promise<Volume[]> {
    return await invoke('get_volumes', { project });
}

export async function getVolume(id: string): Promise<Volume | null> {
    return await invoke('get_volume', { id });
}

export async function saveVolume(project: string, data: Volume): Promise<Volume> {
    return await invoke('save_volume', { project, data });
}

export async function deleteVolume(id: string): Promise<void> {
    return await invoke('delete_volume', { id });
}

export async function getArcs(project: string): Promise<Arc[]> {
    return await invoke('get_arcs', { project });
}

export async function getArc(id: string): Promise<Arc | null> {
    return await invoke('get_arc', { id });
}

export async function saveArc(project: string, data: Arc): Promise<Arc> {
    return await invoke('save_arc', { project, data });
}

export async function deleteArc(id: string): Promise<void> {
    return await invoke('delete_arc', { id });
}

export async function getPlans(project: string): Promise<Plan[]> {
    return await invoke('get_plans', { project });
}

export async function getPlan(id: string): Promise<Plan | null> {
    return await invoke('get_plan', { id });
}

export async function savePlan(project: string, data: Plan): Promise<Plan> {
    return await invoke('save_plan', { project, data });
}

export async function deletePlan(id: string): Promise<void> {
    return await invoke('delete_plan', { id });
}

export async function getTags(project: string): Promise<Tag[]> {
    return await invoke('get_tags', { project });
}

export async function getTag(id: string): Promise<Tag | null> {
    return await invoke('get_tag', { id });
}

export async function saveTag(project: string, data: Tag): Promise<Tag> {
    return await invoke('save_tag', { project, data });
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

export async function saveCalendar(project: string, data: Calendar): Promise<Calendar> {
    return await invoke('save_calendar', { project, data });
}

export async function deleteCalendar(id: string): Promise<void> {
    return await invoke('delete_calendar', { id });
}

export async function getTextblocks(project: string): Promise<TextBlock[]> {
    return await invoke('get_textblocks', { project });
}

export async function getTextblock(id: string): Promise<TextBlock | null> {
    return await invoke('get_textblock', { id });
}

export async function saveTextblock(project: string, data: TextBlock): Promise<TextBlock> {
    return await invoke('save_textblock', { project, data });
}

export async function deleteTextblock(id: string): Promise<void> {
    return await invoke('delete_textblock', { id });
}

export async function searchTextblocks(project: string, query: string): Promise<SearchResult<TextBlock>[]> {
    return await invoke('search_textblocks', { project, query });
}

export async function getChatmessages(project: string): Promise<ChatMessage[]> {
    return await invoke('get_chatmessages', { project });
}

export async function getChatmessage(id: string): Promise<ChatMessage | null> {
    return await invoke('get_chatmessage', { id });
}

export async function saveChatmessage(project: string, data: ChatMessage): Promise<ChatMessage> {
    return await invoke('save_chatmessage', { project, data });
}

export async function deleteChatmessage(id: string): Promise<void> {
    return await invoke('delete_chatmessage', { id });
}

export async function searchChatmessages(project: string, query: string): Promise<SearchResult<ChatMessage>[]> {
    return await invoke('search_chatmessages', { project, query });
}

export async function getAgentmemorys(project: string): Promise<AgentMemory[]> {
    return await invoke('get_agentmemorys', { project });
}

export async function getAgentmemory(id: string): Promise<AgentMemory | null> {
    return await invoke('get_agentmemory', { id });
}

export async function saveAgentmemory(project: string, data: AgentMemory): Promise<AgentMemory> {
    return await invoke('save_agentmemory', { project, data });
}

export async function deleteAgentmemory(id: string): Promise<void> {
    return await invoke('delete_agentmemory', { id });
}

export async function searchAgentmemorys(project: string, query: string): Promise<SearchResult<AgentMemory>[]> {
    return await invoke('search_agentmemorys', { project, query });
}

export async function getWebcaches(project: string): Promise<WebCache[]> {
    return await invoke('get_webcaches', { project });
}

export async function getWebcache(id: string): Promise<WebCache | null> {
    return await invoke('get_webcache', { id });
}

export async function saveWebcache(project: string, data: WebCache): Promise<WebCache> {
    return await invoke('save_webcache', { project, data });
}

export async function deleteWebcache(id: string): Promise<void> {
    return await invoke('delete_webcache', { id });
}

export async function searchWebcaches(project: string, query: string): Promise<SearchResult<WebCache>[]> {
    return await invoke('search_webcaches', { project, query });
}

// --- Relations CRUD ---
export async function getCites(fromId: string, toId: string): Promise<Cites[]> {
    return await invoke('get_cites', { fromId, toId });
}

export async function createCite(fromId: string, toId: string, data: Cites): Promise<Cites> {
    return await invoke('create_cite', { fromId, toId, data });
}

export async function deleteCite(id: string): Promise<void> {
    return await invoke('delete_cite', { id });
}

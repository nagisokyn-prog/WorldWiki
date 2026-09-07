/**
 * @file api.client.ts
 * @description Автоматически сгенерированный клиент для Tauri invoke.
 * НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ! Запустите `node scripts/codegen.js` для обновления.
 */
import { invoke } from '@tauri-apps/api/core';
export interface SearchResult<T> { entity: T; score: number; kind: string; }
export interface AutoExtendResult { chapter_id?: string | null; arc_id?: string | null; volume_id?: string | null; updated_count?: number; }
export interface ChapterHierarchy { volumes: (Volume & { sort_order?: number; [key: string]: unknown })[]; arcs: (Arc & { volume_id?: string | null; sort_order?: number; [key: string]: unknown })[]; chapters: (Chapter & { arc_id?: string | null; volume_id?: string | null; sort_order?: number; [key: string]: unknown })[]; }
export interface ProjectSummary { id?: string; name: string; created_at?: string; genres?: string[]; perfLevel?: string; data?: Record<string, unknown>; stats?: Record<string, unknown>; icon?: string; [key: string]: unknown; }
import type { Volume } from '../types/generated/Volume';
import type { Arc } from '../types/generated/Arc';
import type { Chapter } from '../types/generated/Chapter';
import type { Entity } from '../types/generated/Entity';
import type { EntitySchema } from '../types/generated/EntitySchema';
import type { EntityRel } from '../types/generated/EntityRel';
import type { RelationSchema } from '../types/generated/RelationSchema';
import type { Chat } from '../types/generated/Chat';
import type { ChatMessage } from '../types/generated/ChatMessage';
import type { AiProfile } from '../types/generated/AiProfile';
import type { PlotPromise } from '../types/generated/PlotPromise';
import type { Plan } from '../types/generated/Plan';
import type { Tag } from '../types/generated/Tag';
import type { Calendar } from '../types/generated/Calendar';
import type { AutoApprovalSetting } from '../types/generated/AutoApprovalSetting';
import type { AiMode } from '../types/generated/AiMode';
import type { Artifact } from '../types/generated/Artifact';
import type { AiSkill } from '../types/generated/AiSkill';
import type { TextBlock } from '../types/generated/TextBlock';
import type { AgentMemory } from '../types/generated/AgentMemory';
import type { WebCache } from '../types/generated/WebCache';
import type { DictionaryWord } from '../types/generated/DictionaryWord';
import type { Cites } from '../types/generated/Cites';

// --- Normal Commands ---
export async function getProjects(): Promise<ProjectSummary[]> {
    return await invoke('get_projects');
}

export async function createProject(projectData: unknown): Promise<string> {
    return await invoke('create_project', { projectData });
}

export async function getProjectConfig(name: string): Promise<unknown> {
    return await invoke('get_project_config', { name });
}

export async function saveProjectConfig(name: string, config: unknown): Promise<unknown> {
    return await invoke('save_project_config', { name, config });
}

export async function deleteProject(name: string): Promise<string> {
    return await invoke('delete_project', { name });
}

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

export async function uploadPhoto(bytes: number[], filename: string): Promise<string> {
    return await invoke('upload_photo', { bytes, filename });
}

export async function copyBackgroundFile(sourcePath: string): Promise<string> {
    return await invoke('copy_background_file', { sourcePath });
}

export async function getLocalFile(path: string): Promise<number[]> {
    return await invoke('get_local_file', { path });
}

export async function runPerformanceBenchmark(): Promise<unknown> {
    return await invoke('run_performance_benchmark');
}

export async function getPerformanceStyles(level: string): Promise<Record<string, unknown>> {
    return await invoke('get_performance_styles', { level });
}

export async function saveSettings(settings: unknown): Promise<void> {
    return await invoke('save_settings', { settings });
}

export async function loadSettings(): Promise<Record<string, unknown>> {
    return await invoke('load_settings');
}

export async function toggleFullscreen(): Promise<void> {
    return await invoke('toggle_fullscreen');
}

export async function getCustomThemes(): Promise<Record<string, unknown>[]> {
    return await invoke('get_custom_themes');
}

export async function loadTheme(theme: string): Promise<Record<string, unknown>> {
    return await invoke('load_theme', { theme });
}

export async function saveCustomTheme(name: string, settings: unknown): Promise<void> {
    return await invoke('save_custom_theme', { name, settings });
}

export async function getChapterHierarchy(project: string): Promise<ChapterHierarchy> {
    return await invoke('get_chapter_hierarchy', { project });
}

export async function createVolume(project: string, title: string): Promise<unknown> {
    return await invoke('create_volume', { project, title });
}

export async function updateVolume(project: string, id: string, title: string): Promise<void> {
    return await invoke('update_volume', { project, id, title });
}

export async function createArc(project: string, title: string, volumeId: string | null): Promise<unknown> {
    return await invoke('create_arc', { project, title, volumeId });
}

export async function updateArc(project: string, id: string, title: string, volumeId: string | null): Promise<void> {
    return await invoke('update_arc', { project, id, title, volumeId });
}

export async function assignChapter(project: string, chapterId: string, arcId: string | null, volumeId: string | null): Promise<unknown> {
    return await invoke('assign_chapter', { project, chapterId, arcId, volumeId });
}

export async function reorderNode(project: string, nodeType: string, id: string, sortOrder: number): Promise<void> {
    return await invoke('reorder_node', { project, nodeType, id, sortOrder });
}

export async function autoExtendTimeline(project: string, chapterId: string, arcId: string | null, volumeId: string | null): Promise<unknown> {
    return await invoke('auto_extend_timeline', { project, chapterId, arcId, volumeId });
}

export async function healDeletedChapter(project: string, deletedChapterId: string, fallbackPoint: unknown | null): Promise<number> {
    return await invoke('heal_deleted_chapter', { project, deletedChapterId, fallbackPoint });
}

export async function getConnections(project: string, chapter: string | null): Promise<unknown> {
    return await invoke('get_connections', { project, chapter });
}

export async function saveConnections(project: string, sourceId: string, data: unknown): Promise<void> {
    return await invoke('save_connections', { project, sourceId, data });
}

export async function upsertConnectionsBatch(project: string, sourceType: string, sourceId: string, connections: EntityRel[]): Promise<void> {
    return await invoke('upsert_connections_batch', { project, sourceType, sourceId, connections });
}

export async function removeConnectionsBySource(project: string, eType: string, eId: string): Promise<number> {
    return await invoke('remove_connections_by_source', { project, eType, eId });
}

export async function getGlobalTimeline(project: string): Promise<unknown> {
    return await invoke('get_global_timeline', { project });
}

export async function saveGlobalTimeline(project: string, data: unknown): Promise<unknown> {
    return await invoke('save_global_timeline', { project, data });
}

export async function exportChapters(project: string, chapters: unknown[], format: string): Promise<string> {
    return await invoke('export_chapters', { project, chapters, format });
}

export async function exportDocumentDocx(request: unknown): Promise<unknown> {
    return await invoke('export_document_docx', { request });
}

export async function exportDocumentEpub(request: unknown): Promise<unknown> {
    return await invoke('export_document_epub', { request });
}

export async function exportDocumentFb2(request: unknown): Promise<unknown> {
    return await invoke('export_document_fb2', { request });
}

export async function exportDocumentPdfSave(fileName: string, pdfBytesBase64: string): Promise<unknown> {
    return await invoke('export_document_pdf_save', { fileName, pdfBytesBase64 });
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

export async function listYandexDiskBackups(token: string): Promise<unknown[]> {
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

export async function convertAbsoluteToLocal(absoluteMinute: number, calendar: unknown, eraIndex: number): Promise<unknown> {
    return await invoke('convert_absolute_to_local', { absoluteMinute, calendar, eraIndex });
}

export async function convertCalendarDate(fromCalendar: unknown, toCalendar: unknown, masterCalendar: unknown | null, eraIndex: number, year: number, month: number, day: number, hour: number, minute: number, targetEraIndex: number | null): Promise<unknown> {
    return await invoke('convert_calendar_date', { fromCalendar, toCalendar, masterCalendar, eraIndex, year, month, day, hour, minute, targetEraIndex });
}

export async function saveTextBlocks(project: string, chapterId: string, html: string): Promise<void> {
    return await invoke('save_text_blocks', { project, chapterId, html });
}

export async function getChatTree(projectId: string): Promise<Chat[]> {
    return await invoke('get_chat_tree', { projectId });
}

export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
    return await invoke('get_chat_messages', { chatId });
}

export async function getMessageBranch(chatId: string): Promise<ChatMessage[]> {
    return await invoke('get_message_branch', { chatId });
}

export async function forkChat(projectId: string, messageId: string, newTitle: string): Promise<Chat> {
    return await invoke('fork_chat', { projectId, messageId, newTitle });
}

export async function saveChat(data: Chat): Promise<Chat> {
    return await invoke('save_chat', { data });
}

export async function updateChatParent(chatId: string, newParentId: string | null): Promise<void> {
    return await invoke('update_chat_parent', { chatId, newParentId });
}

export async function sendChatMessage(chatId: string, text: string, project: string, modeSlug: string | null): Promise<unknown> {
    return await invoke('send_chat_message', { chatId, text, project, modeSlug });
}

export async function cancelGeneration(chatId: string): Promise<void> {
    return await invoke('cancel_generation', { chatId });
}

export async function deleteChatMessage(msgId: string): Promise<void> {
    return await invoke('delete_chat_message', { msgId });
}

export async function switchMessageVariant(msgId: string): Promise<void> {
    return await invoke('switch_message_variant', { msgId });
}

export async function fetchAiModels(provider: string, apiKey: string | null): Promise<unknown[]> {
    return await invoke('fetch_ai_models', { provider, apiKey });
}

export async function deleteAiChat(project: string, id: string): Promise<void> {
    return await invoke('delete_ai_chat', { project, id });
}

export async function getAiprofiles(project: string): Promise<AiProfile[]> {
    return await invoke('get_aiprofiles', { project });
}

export async function saveAiprofile(data: AiProfile): Promise<AiProfile> {
    return await invoke('save_aiprofile', { data });
}

export async function deleteAiprofile(project: string, id: string): Promise<void> {
    return await invoke('delete_aiprofile', { project, id });
}

export async function editChatMessage(msgId: string, newText: string, chatId: string, project: string, modeSlug: string | null): Promise<void> {
    return await invoke('edit_chat_message', { msgId, newText, chatId, project, modeSlug });
}

export async function regenerateChatMessage(parentMsgId: string, chatId: string, project: string, modeSlug: string | null): Promise<void> {
    return await invoke('regenerate_chat_message', { parentMsgId, chatId, project, modeSlug });
}

export async function getHardwareInfo(): Promise<unknown> {
    return await invoke('get_hardware_info');
}

export async function calculateQuantizationEstimates(paramsBillions: number, contextTokens: number | null): Promise<unknown[]> {
    return await invoke('calculate_quantization_estimates', { paramsBillions, contextTokens });
}

export async function getRecommendedLocalModels(): Promise<unknown[]> {
    return await invoke('get_recommended_local_models');
}

export async function listInstalledModels(): Promise<unknown[]> {
    return await invoke('list_installed_models');
}

export async function loadLocalModel(filename: string): Promise<string> {
    return await invoke('load_local_model', { filename });
}

export async function unloadLocalModel(filename: string): Promise<string> {
    return await invoke('unload_local_model', { filename });
}

export async function unloadAllLocalModels(): Promise<string> {
    return await invoke('unload_all_local_models');
}

export async function deleteLocalModel(filename: string): Promise<string> {
    return await invoke('delete_local_model', { filename });
}

export async function getToolPermissionsCatalog(): Promise<unknown[]> {
    return await invoke('get_tool_permissions_catalog');
}

export async function fetchHfModels(query: string | null, token: string | null): Promise<unknown[]> {
    return await invoke('fetch_hf_models', { query, token });
}

export async function downloadHfModel(repoId: string, filename: string, token: string | null): Promise<string> {
    return await invoke('download_hf_model', { repoId, filename, token });
}

export async function reindexProjectLore(projectId: string): Promise<number> {
    return await invoke('reindex_project_lore', { projectId });
}

export async function getEntityFullCard(entityId: string): Promise<unknown> {
    return await invoke('get_entity_full_card', { entityId });
}

export async function addEntityRelation(relation: unknown): Promise<void> {
    return await invoke('add_entity_relation', { relation });
}

export async function plantPlotPromise(promise: PlotPromise): Promise<void> {
    return await invoke('plant_plot_promise', { promise });
}

export async function completePlan(planId: string): Promise<void> {
    return await invoke('complete_plan', { planId });
}

export async function auditVolumeConsistency(volumeId: string): Promise<unknown> {
    return await invoke('audit_volume_consistency', { volumeId });
}

export async function aiQueryWorld(projectId: string, query: string, scope: string, topK: number | null): Promise<unknown[]> {
    return await invoke('ai_query_world', { projectId, query, scope, topK });
}

export async function aiInspectEntity(projectId: string | null, entityId: string): Promise<unknown> {
    return await invoke('ai_inspect_entity', { projectId, entityId });
}

export async function aiManageEntity(action: string, payload: unknown): Promise<unknown> {
    return await invoke('ai_manage_entity', { action, payload });
}

export async function aiReadManuscript(projectId: string | null, chapterId: string): Promise<unknown> {
    return await invoke('ai_read_manuscript', { projectId, chapterId });
}

export async function aiEditManuscript(request: unknown): Promise<unknown> {
    return await invoke('ai_edit_manuscript', { request });
}

export async function aiChronology(action: string, payload: unknown): Promise<unknown> {
    return await invoke('ai_chronology', { action, payload });
}

export async function aiTimelineManager(action: string, payload: unknown): Promise<unknown> {
    return await invoke('ai_timeline_manager', { action, payload });
}

export async function aiAuditConsistency(targetType: string, targetId: string): Promise<unknown> {
    return await invoke('ai_audit_consistency', { targetType, targetId });
}

export async function aiDelegateTask(taskId: string, prompt: string): Promise<unknown> {
    return await invoke('ai_delegate_task', { taskId, prompt });
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

export async function getPlotPromises(project: string): Promise<PlotPromise[]> {
    return await invoke('get_plot_promises', { project });
}

export async function getPlotPromise(id: string): Promise<PlotPromise | null> {
    return await invoke('get_plot_promise', { id });
}

export async function savePlotPromise(project: string, data: PlotPromise): Promise<PlotPromise> {
    return await invoke('save_plot_promise', { project, data });
}

export async function deletePlotPromise(id: string): Promise<void> {
    return await invoke('delete_plot_promise', { id });
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

export async function getChats(project: string): Promise<Chat[]> {
    return await invoke('get_chats', { project });
}

export async function getChat(id: string): Promise<Chat | null> {
    return await invoke('get_chat', { id });
}

export async function deleteChat(id: string): Promise<void> {
    return await invoke('delete_chat', { id });
}

export async function getAutoApprovalSettings(project: string): Promise<AutoApprovalSetting[]> {
    return await invoke('get_auto_approval_settings', { project });
}

export async function getAutoApprovalSetting(id: string): Promise<AutoApprovalSetting | null> {
    return await invoke('get_auto_approval_setting', { id });
}

export async function saveAutoApprovalSetting(project: string, data: AutoApprovalSetting): Promise<AutoApprovalSetting> {
    return await invoke('save_auto_approval_setting', { project, data });
}

export async function deleteAutoApprovalSetting(id: string): Promise<void> {
    return await invoke('delete_auto_approval_setting', { id });
}

export async function getAiProfiles(project: string): Promise<AiProfile[]> {
    return await invoke('get_ai_profiles', { project });
}

export async function getAiProfile(id: string): Promise<AiProfile | null> {
    return await invoke('get_ai_profile', { id });
}

export async function saveAiProfile(project: string, data: AiProfile): Promise<AiProfile> {
    return await invoke('save_ai_profile', { project, data });
}

export async function deleteAiProfile(id: string): Promise<void> {
    return await invoke('delete_ai_profile', { id });
}

export async function getAiModes(project: string): Promise<AiMode[]> {
    return await invoke('get_ai_modes', { project });
}

export async function getAiMode(id: string): Promise<AiMode | null> {
    return await invoke('get_ai_mode', { id });
}

export async function saveAiMode(project: string, data: AiMode): Promise<AiMode> {
    return await invoke('save_ai_mode', { project, data });
}

export async function deleteAiMode(id: string): Promise<void> {
    return await invoke('delete_ai_mode', { id });
}

export async function getArtifacts(project: string): Promise<Artifact[]> {
    return await invoke('get_artifacts', { project });
}

export async function getArtifact(id: string): Promise<Artifact | null> {
    return await invoke('get_artifact', { id });
}

export async function saveArtifact(project: string, data: Artifact): Promise<Artifact> {
    return await invoke('save_artifact', { project, data });
}

export async function deleteArtifact(id: string): Promise<void> {
    return await invoke('delete_artifact', { id });
}

export async function getAiSkills(project: string): Promise<AiSkill[]> {
    return await invoke('get_ai_skills', { project });
}

export async function getAiSkill(id: string): Promise<AiSkill | null> {
    return await invoke('get_ai_skill', { id });
}

export async function saveAiSkill(project: string, data: AiSkill): Promise<AiSkill> {
    return await invoke('save_ai_skill', { project, data });
}

export async function deleteAiSkill(id: string): Promise<void> {
    return await invoke('delete_ai_skill', { id });
}

export async function getTextBlocks(project: string): Promise<TextBlock[]> {
    return await invoke('get_text_blocks', { project });
}

export async function getTextBlock(id: string): Promise<TextBlock | null> {
    return await invoke('get_text_block', { id });
}

export async function saveTextBlock(project: string, data: TextBlock): Promise<TextBlock> {
    return await invoke('save_text_block', { project, data });
}

export async function deleteTextBlock(id: string): Promise<void> {
    return await invoke('delete_text_block', { id });
}

export async function searchTextBlocks(project: string, query: string): Promise<SearchResult<TextBlock>[]> {
    return await invoke('search_text_blocks', { project, query });
}

export async function getChatMessage(id: string): Promise<ChatMessage | null> {
    return await invoke('get_chat_message', { id });
}

export async function saveChatMessage(project: string, data: ChatMessage): Promise<ChatMessage> {
    return await invoke('save_chat_message', { project, data });
}

export async function searchChatMessages(project: string, query: string): Promise<SearchResult<ChatMessage>[]> {
    return await invoke('search_chat_messages', { project, query });
}

export async function getAgentMemorys(project: string): Promise<AgentMemory[]> {
    return await invoke('get_agent_memorys', { project });
}

export async function getAgentMemory(id: string): Promise<AgentMemory | null> {
    return await invoke('get_agent_memory', { id });
}

export async function saveAgentMemory(project: string, data: AgentMemory): Promise<AgentMemory> {
    return await invoke('save_agent_memory', { project, data });
}

export async function deleteAgentMemory(id: string): Promise<void> {
    return await invoke('delete_agent_memory', { id });
}

export async function searchAgentMemorys(project: string, query: string): Promise<SearchResult<AgentMemory>[]> {
    return await invoke('search_agent_memorys', { project, query });
}

export async function getWebCaches(project: string): Promise<WebCache[]> {
    return await invoke('get_web_caches', { project });
}

export async function getWebCache(id: string): Promise<WebCache | null> {
    return await invoke('get_web_cache', { id });
}

export async function saveWebCache(project: string, data: WebCache): Promise<WebCache> {
    return await invoke('save_web_cache', { project, data });
}

export async function deleteWebCache(id: string): Promise<void> {
    return await invoke('delete_web_cache', { id });
}

export async function searchWebCaches(project: string, query: string): Promise<SearchResult<WebCache>[]> {
    return await invoke('search_web_caches', { project, query });
}

export async function getDictionaryWords(project: string): Promise<DictionaryWord[]> {
    return await invoke('get_dictionary_words', { project });
}

export async function getDictionaryWord(id: string): Promise<DictionaryWord | null> {
    return await invoke('get_dictionary_word', { id });
}

export async function saveDictionaryWord(project: string, data: DictionaryWord): Promise<DictionaryWord> {
    return await invoke('save_dictionary_word', { project, data });
}

export async function deleteDictionaryWord(id: string): Promise<void> {
    return await invoke('delete_dictionary_word', { id });
}

export async function searchDictionaryWords(project: string, query: string): Promise<SearchResult<DictionaryWord>[]> {
    return await invoke('search_dictionary_words', { project, query });
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

import { invoke } from '@tauri-apps/api/core';
import type { Chat } from '../../types/generated/Chat';
import type { ChatMessage } from '../../types/generated/ChatMessage';
import type { AiProfile } from '../../types/generated/AiProfile';
import type { AutoApprovalSetting } from '../../types/generated/AutoApprovalSetting';
import type { AiMode } from '../../types/generated/AiMode';
import type { Artifact } from '../../types/generated/Artifact';
import type { AiSkill } from '../../types/generated/AiSkill';
import type { AgentMemory } from '../../types/generated/AgentMemory';
import type { WebCache } from '../../types/generated/WebCache';
import type { DictionaryWord } from '../../types/generated/DictionaryWord';
import type { SearchResult } from './api.types';

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

export async function editChatMessage(msgId: string, newText: string, chatId: string, project: string, modeSlug: string | null): Promise<void> {
  return await invoke('edit_chat_message', { msgId, newText, chatId, project, modeSlug });
}

export async function regenerateChatMessage(parentMsgId: string, chatId: string, project: string, modeSlug: string | null): Promise<void> {
  return await invoke('regenerate_chat_message', { parentMsgId, chatId, project, modeSlug });
}

export async function executeAiToolDirect(project: string, toolName: string, toolInput: unknown): Promise<unknown> {
  return await invoke('execute_ai_tool_direct', { project, toolName, toolInput });
}

export async function aiRespondToolApproval(callId: string, approved: boolean): Promise<boolean> {
  return await invoke('ai_respond_tool_approval', { callId, approved });
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

export async function saveToolPermission(toolId: string, level: string): Promise<void> {
  return await invoke('save_tool_permission', { toolId, level });
}

export async function saveAllToolPermissions(permissions: unknown): Promise<void> {
  return await invoke('save_all_tool_permissions', { permissions });
}

export async function getAiCompletion(textBefore: string, projectId: string | null): Promise<string> {
  return await invoke('get_ai_completion', { textBefore, projectId });
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

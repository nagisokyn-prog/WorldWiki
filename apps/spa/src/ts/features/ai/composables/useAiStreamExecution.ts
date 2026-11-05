import { ref } from 'vue';
import type { Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage, MessageVariantGroup } from '@/features/ai/types/aiPanel.model';
import type { AiSkillItem } from '../skills/aiSkills.model';
import { buildSkillContext } from '../skills/skillTriggerRouter';
import { useAiStreamListener } from './useAiStreamListener';
import {
  sendChatMessage,
  cancelGeneration as cancelGenApi,
  regenerateChatMessage as regenChatMsgApi,
  aiRespondToolApproval,
} from '@/services/api.client';

export function useAiStreamExecution(options: {
  activeChatId: Ref<string>;
  currentProject: string;
  activeModeSlug: Ref<string>;
  allMessages: Ref<ChatMessage[]>;
  renderedMessages: Ref<MessageVariantGroup[]>;
  skills: Ref<AiSkillItem[]>;
  activeQuote: Ref<{ selected_text: string; source_message_id?: string } | null>;
  chats: Ref<Array<{ id: string; token_usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } }>>;
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  scrollToBottom: () => void;
  chatInputRef?: Ref<{ unlock: () => void } | null>;
}) {
  const isGenerating = ref(false);
  const hasError = ref(false);
  const isSending = ref(false);
  const tokenUsage = ref({ input_tokens: 0, output_tokens: 0, total_tokens: 0 });

  useAiStreamListener({
    activeChatId: options.activeChatId,
    allMessages: options.allMessages,
    renderedMessages: options.renderedMessages,
    tokenUsage,
    chats: options.chats,
    isGenerating,
    hasError,
    loadMessages: options.loadMessages,
    loadChats: options.loadChats,
  });

  const cancelGeneration = async () => {
    try {
      if (options.activeChatId.value) {
        await cancelGenApi(options.activeChatId.value);
      }
    } catch (err) {
      console.error('Failed to cancel generation:', err);
    } finally {
      isGenerating.value = false;
    }
  };

  const regenerateMessage = async (msgId: string) => {
    if (!options.activeChatId.value) return;
    try {
      isGenerating.value = true;
      await regenChatMsgApi(
        msgId,
        options.activeChatId.value,
        options.currentProject,
        options.activeModeSlug.value || null
      );
    } catch (err) {
      console.error('Failed to regenerate message:', err);
      isGenerating.value = false;
    }
  };

  const triggerSend = async (text: string) => {
    if (!text.trim()) return;
    const currentChatId = options.activeChatId.value || 'new';
    isGenerating.value = true;

    const lastGroup = options.renderedMessages.value[options.renderedMessages.value.length - 1];
    const parentId =
      lastGroup?.activeMessage?.id ??
      (options.allMessages.value.length > 0 ? options.allMessages.value[options.allMessages.value.length - 1].id ?? null : null);

    const userMsgIdx = options.allMessages.value.length;
    options.allMessages.value.push({
      role: 'user',
      content: text,
      parent_id: parentId,
    });

    const { augmentedMessage } = await buildSkillContext(text, options.skills.value);
    let messageToSend = augmentedMessage;

    if (options.activeQuote.value) {
      messageToSend = `[Цитата]: «${options.activeQuote.value.selected_text}»\n\n${messageToSend}`;
      options.activeQuote.value = null;
    }

    try {
      const res = (await sendChatMessage(
        currentChatId,
        messageToSend,
        options.currentProject,
        options.activeModeSlug.value || null
      )) as {
        chat_id?: string;
        assistant_msg_id?: string;
        user_msg_id?: string;
      } | null;

      if (res && res.chat_id) {
        options.activeChatId.value = res.chat_id;

        if (res.user_msg_id && options.allMessages.value[userMsgIdx]) {
          options.allMessages.value[userMsgIdx] = {
            ...options.allMessages.value[userMsgIdx],
            id: res.user_msg_id,
            parent_id: parentId,
          };
        }

        if (res.assistant_msg_id) {
          options.allMessages.value.push({
            id: res.assistant_msg_id,
            role: 'assistant',
            content: '',
            parent_id: res.user_msg_id ?? null,
          });
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      isGenerating.value = false;
    }
  };

  const sendMessage = async (text: string) => {
    if (isSending.value || isGenerating.value || !text.trim()) return;

    isSending.value = true;
    try {
      await triggerSend(text);
      await options.loadChats();
      options.scrollToBottom();
    } finally {
      isSending.value = false;
      options.chatInputRef?.value?.unlock();
    }
  };

  const retryLastMessage = async () => {
    if (isGenerating.value || isSending.value) return;
    hasError.value = false;
    const lastAssistant = [...options.allMessages.value].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant && lastAssistant.parent_id) {
      await regenerateMessage(lastAssistant.parent_id);
    }
  };

  const unloadModels = async () => {
    try {
      await invoke('cancel_generation', { chatId: options.activeChatId.value || '' }).catch(() => {});
      await invoke('unload_all_local_models');
      const { appAlert } = await import('@worldwiki/components');
      appAlert('Память GPU успешно очищена.');
    } catch (e) {
      console.error('Ошибка выгрузки моделей:', e);
    }
  };

  const handleToolApproval = async (data: { toolCallId?: string; approved?: boolean } | unknown) => {
    const payload = data as { toolCallId?: string; approved?: boolean };
    const callId = payload?.toolCallId;
    if (callId) {
      try {
        await aiRespondToolApproval(callId, true);
      } catch (err) {
        console.error('Failed to approve tool call:', err);
      }
      const msg = options.allMessages.value.find((m) => m.toolCallWaiting?.tool_call_id === callId);
      if (msg) {
        msg.toolCallWaiting = null;
      }
    }
  };

  const handleToolRejection = async (data: { toolCallId?: string; approved?: boolean; feedback?: string } | unknown) => {
    const payload = data as { toolCallId?: string; approved?: boolean; feedback?: string };
    const callId = payload?.toolCallId;
    if (callId) {
      try {
        await aiRespondToolApproval(callId, false);
      } catch (err) {
        console.error('Failed to reject tool call:', err);
      }
      const msg = options.allMessages.value.find((m) => m.toolCallWaiting?.tool_call_id === callId);
      if (msg) {
        msg.toolCallWaiting = null;
      }
    }
  };

  return {
    isGenerating,
    hasError,
    isSending,
    tokenUsage,
    cancelGeneration,
    regenerateMessage,
    sendMessage,
    retryLastMessage,
    unloadModels,
    handleToolApproval,
    handleToolRejection,
  };
}

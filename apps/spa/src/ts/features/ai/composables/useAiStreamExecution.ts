import { ref, onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ChatMessage, MessageVariantGroup } from '../types/aiPanel.model';
import type { AiSkillItem } from '../skills/aiSkills.model';
import { buildSkillContext } from '../skills/skillTriggerRouter';
import {
  sendChatMessage,
  cancelGeneration as cancelGenApi,
  regenerateChatMessage as regenChatMsgApi,
  aiRespondToolApproval,
} from '../../../services/api.client';

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

  let unlistenChunk: UnlistenFn | null = null;
  let unlistenApproval: UnlistenFn | null = null;

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

  onMounted(async () => {
    unlistenApproval = await listen<{
      call_id: string;
      chat_id: string;
      assistant_msg_id: string;
      tool_name: string;
      action?: string;
      payload?: unknown;
      description?: string;
    }>('ww-ai-tool-approval-request', (event) => {
      const req = event.payload;
      if (req.chat_id && options.activeChatId.value && req.chat_id !== options.activeChatId.value) {
        return;
      }
      const msg =
        options.allMessages.value.find((m) => m.id === req.assistant_msg_id) ||
        options.allMessages.value[options.allMessages.value.length - 1];
      if (msg) {
        msg.toolCallWaiting = {
          tool_call_id: req.call_id,
          tool_name: req.tool_name,
          tool_args: req.payload,
          action: req.action,
          description: req.description,
        };
      }
    });

    unlistenChunk = await listen<{
      chat_id: string;
      message_id: string;
      chunk_type?: string;
      text: string;
      is_done?: boolean;
    }>('chat_stream_chunk', (event) => {
      const chunk = event.payload;
      const msg = options.allMessages.value.find((m) => m.id === chunk.message_id);

      if (!msg) {
        if (chunk.chat_id !== options.activeChatId.value) return;
        const lastGroup = options.renderedMessages.value[options.renderedMessages.value.length - 1];
        const parentId = lastGroup?.activeMessage?.id ?? null;
        const newMsg: ChatMessage = {
          id: chunk.message_id,
          role: 'assistant',
          content: '',
          parent_id: parentId,
          is_active: true,
        };
        options.allMessages.value.push(newMsg);
        if (chunk.chunk_type === 'reasoning') {
          newMsg.reasoning = chunk.text;
        } else if (chunk.chunk_type === 'tool_log') {
          newMsg.toolLogs = [chunk.text];
        } else if (chunk.chunk_type === 'error') {
          newMsg.is_error = true;
          hasError.value = true;
          newMsg.content = chunk.text;
        } else if (chunk.chunk_type === 'usage') {
          try {
            const u = JSON.parse(chunk.text);
            if (u && (u.total_tokens > 0 || u.input_tokens > 0 || u.output_tokens > 0)) {
              tokenUsage.value = u;
              const targetChat = options.chats.value.find((c) => c.id === (chunk.chat_id || options.activeChatId.value));
              if (targetChat) {
                targetChat.token_usage = u;
              }
            }
          } catch {
            // ignore
          }
        } else {
          newMsg.content = chunk.text;
        }
        if (chunk.is_done) {
          isGenerating.value = false;
          if (
            newMsg.is_error ||
            newMsg.content.startsWith('🚫') ||
            newMsg.content.startsWith('⚠️') ||
            newMsg.content.startsWith('🔑')
          ) {
            hasError.value = true;
          }
          if (options.activeChatId.value) {
            void options.loadMessages(options.activeChatId.value);
            void options.loadChats();
          }
        }
        return;
      }

      if (chunk.chunk_type === 'reasoning') {
        msg.reasoning = (msg.reasoning || '') + chunk.text;
      } else if (chunk.chunk_type === 'tool_log') {
        if (!msg.toolLogs) msg.toolLogs = [];
        msg.toolLogs.push(chunk.text);
      } else if (chunk.chunk_type === 'error') {
        msg.is_error = true;
        hasError.value = true;
        msg.content = (msg.content || '') + chunk.text;
      } else if (chunk.chunk_type === 'usage') {
        try {
          const u = JSON.parse(chunk.text);
          if (u && (u.total_tokens > 0 || u.input_tokens > 0 || u.output_tokens > 0)) {
            tokenUsage.value = u;
            const targetChat = options.chats.value.find((c) => c.id === (chunk.chat_id || options.activeChatId.value));
            if (targetChat) {
              targetChat.token_usage = u;
            }
          }
        } catch {
          // ignore
        }
      } else {
        msg.content = (msg.content || '') + chunk.text;
      }

      if (chunk.is_done) {
        isGenerating.value = false;
        if (
          msg.is_error ||
          msg.content.startsWith('🚫') ||
          msg.content.startsWith('⚠️') ||
          msg.content.startsWith('🔑')
        ) {
          hasError.value = true;
        }
        if (options.activeChatId.value) {
          void options.loadMessages(options.activeChatId.value);
          void options.loadChats();
        }
      }
    });
  });

  onUnmounted(() => {
    if (unlistenChunk) unlistenChunk();
    if (unlistenApproval) unlistenApproval();
  });

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

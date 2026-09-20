import { onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ChatMessage, MessageVariantGroup } from '../types/aiPanel.model';

export function useAiStreamListener(options: {
  activeChatId: Ref<string>;
  allMessages: Ref<ChatMessage[]>;
  renderedMessages: Ref<MessageVariantGroup[]>;
  tokenUsage: Ref<{ input_tokens: number; output_tokens: number; total_tokens: number }>;
  chats: Ref<Array<{ id: string; token_usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } }>>;
  isGenerating: Ref<boolean>;
  hasError: Ref<boolean>;
  loadMessages: (chatId: string) => Promise<void>;
  loadChats: () => Promise<void>;
}) {
  let unlistenChunk: UnlistenFn | null = null;
  let unlistenApproval: UnlistenFn | null = null;

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
          options.hasError.value = true;
          newMsg.content = chunk.text;
        } else if (chunk.chunk_type === 'usage') {
          try {
            const u = JSON.parse(chunk.text);
            if (u && (u.total_tokens > 0 || u.input_tokens > 0 || u.output_tokens > 0)) {
              options.tokenUsage.value = u;
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
          options.isGenerating.value = false;
          if (
            newMsg.is_error ||
            newMsg.content.startsWith('🚫') ||
            newMsg.content.startsWith('⚠️') ||
            newMsg.content.startsWith('🔑')
          ) {
            options.hasError.value = true;
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
        options.hasError.value = true;
        msg.content = (msg.content || '') + chunk.text;
      } else if (chunk.chunk_type === 'usage') {
        try {
          const u = JSON.parse(chunk.text);
          if (u && (u.total_tokens > 0 || u.input_tokens > 0 || u.output_tokens > 0)) {
            options.tokenUsage.value = u;
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
        options.isGenerating.value = false;
        if (
          msg.is_error ||
          msg.content.startsWith('🚫') ||
          msg.content.startsWith('⚠️') ||
          msg.content.startsWith('🔑')
        ) {
          options.hasError.value = true;
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
}

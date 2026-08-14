import { ref, type Ref, onMounted, onUnmounted, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  toolLogs?: string[];
  toolCallWaiting?: any;
  parent_id?: string | null;
  is_active?: boolean;
}

export interface MessageVariantGroup {
  variants: ChatMessage[];
  activeIndex: number;
  activeMessage: ChatMessage;
}

export function useWowilonPanel(
  activeChatId: Ref<string> = ref(''),
  currentProject: string = '',
  activeModeSlug: Ref<string> = ref('chat')
) {
  const allMessages = ref<ChatMessage[]>([]);
  const isGenerating = ref(false);
  const tokenUsage = ref({ input_tokens: 0, output_tokens: 0, total_tokens: 0 });
  let unlistenChunk: UnlistenFn | null = null;

  onMounted(async () => {
    unlistenChunk = await listen<any>('chat_stream_chunk', (event) => {
      const chunk = event.payload;
      if (chunk.chat_id === activeChatId.value) {
        let msg = allMessages.value.find(m => m.id === chunk.message_id);
        if (!msg) {
          console.warn('[STREAM] Unknown message_id from stream:', chunk.message_id, '— known ids:', allMessages.value.map(m => m.id));
          // Don't create an orphan — it would corrupt the tree
          // Instead, wait for next loadMessages to pick it up
          return;
        }
        
        if (chunk.chunk_type === 'reasoning') {
          msg.reasoning = (msg.reasoning || '') + chunk.text;
        } else if (chunk.chunk_type === 'tool_log') {
          if (!msg.toolLogs) msg.toolLogs = [];
          msg.toolLogs.push(chunk.text);
        } else if (chunk.chunk_type === 'usage') {
          try {
            const u = JSON.parse(chunk.text);
            tokenUsage.value = u;
          } catch(e) {}
        } else {
          msg.content = chunk.text;
        }

        if (chunk.is_done) {
          isGenerating.value = false;
        }
      }
    });
  });

  onUnmounted(() => {
    if (unlistenChunk) {
      unlistenChunk();
    }
  });



  const loadMessages = async (chatId: string) => {
    try {
      if (!chatId) {
        allMessages.value = [];
        return;
      }
      const data = await invoke<any[]>('get_chat_messages', { chatId });
      const loaded = data.map(m => ({
        id: m.id,
        role: m.role || 'user',
        content: m.content || '',
        reasoning: m.reasoning || '',
        toolLogs: m.tool_logs || [],
        parent_id: m.parent_id ?? null,
        is_active: m.is_active !== false // default true
      }));
      console.log('[LOAD MSGS]', loaded.map(m => `${m.role}:${m.id} parent=${m.parent_id} active=${m.is_active}`));
      // Merge: keep streaming messages that don't exist in DB yet (in-flight)
      const loadedIds = new Set(loaded.map(m => m.id));
      const inFlight = allMessages.value.filter(m => m.id && !loadedIds.has(m.id) && m.role === 'assistant');
      allMessages.value = [...loaded, ...inFlight];
    } catch(e) {
      console.error('Failed to load messages', e);
      allMessages.value = [];
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Временно создаем фейковый id для UI, пока ждем ответа
    const tempId = `temp_${Date.now()}`;
    const activeLeaf = renderedMessages.value.length > 0 
      ? renderedMessages.value[renderedMessages.value.length - 1].activeMessage 
      : null;
      
    allMessages.value.push({ 
      id: tempId, 
      role: 'user', 
      content: text, 
      parent_id: activeLeaf?.id || null, 
      is_active: true 
    });
    isGenerating.value = true;

    try {
      const res = await invoke<{ chat_id: string; assistant_msg_id: string, user_msg_id: string }>('send_chat_message', {
        chatId: activeChatId.value,
        text: text,
        project: currentProject,
        modeSlug: activeModeSlug.value
      });

      if (res.chat_id && res.chat_id !== activeChatId.value) {
        if (activeChatId.value === '') {
          invoke('generate_chat_title', { 
            chatId: res.chat_id, 
            promptText: text,
            projectId: currentProject
          }).catch(console.error);
        }
        activeChatId.value = res.chat_id;
      }

      // Подставляем реальный ID
      const uMsg = allMessages.value.find(m => m.id === tempId);
      if (uMsg) uMsg.id = res.user_msg_id;

      const exists = allMessages.value.find(m => m.id === res.assistant_msg_id);
      if (!exists) {
        allMessages.value.push({
          id: res.assistant_msg_id,
          role: 'assistant',
          content: '',
          parent_id: res.user_msg_id,
          is_active: true
        });
      }
    } catch(e) {
      console.error('Failed to send message', e);
      isGenerating.value = false;
    }
  };

  const cancelGeneration = async () => {
    if (isGenerating.value) {
      isGenerating.value = false;
      try {
        await invoke('cancel_generation', { chatId: activeChatId.value });
      } catch (e) {
        console.error('Failed to cancel generation', e);
      }
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!msgId || msgId.startsWith('temp_')) return;
    try {
      await invoke('delete_chat_message', { msgId });
      allMessages.value = allMessages.value.filter(m => m.id !== msgId);
    } catch(e) {
      console.error('Failed to delete message', e);
    }
  };

  const editMessage = async (msgId: string, newText: string) => {
    if (!msgId || msgId.startsWith('temp_') || !newText.trim()) return;
    isGenerating.value = true;
    try {
      const res = await invoke<{ chat_id: string; assistant_msg_id: string, user_msg_id: string }>('edit_chat_message', {
        msgId,
        newText,
        chatId: activeChatId.value,
        project: currentProject,
        modeSlug: activeModeSlug.value
      });
      
      // Pre-create the placeholder so that if the stream starts immediately, it doesn't get dropped
      const exists = allMessages.value.find(m => m.id === res.assistant_msg_id);
      if (!exists) {
        allMessages.value.push({
          id: res.assistant_msg_id,
          role: 'assistant',
          content: '',
          reasoning: '',
          toolLogs: [],
          parent_id: res.user_msg_id,
          is_active: true
        });
      }

      // reload fully because states (is_active) changed on backend
      await loadMessages(activeChatId.value);
    } catch(e) {
      console.error('Failed to edit message', e);
      isGenerating.value = false;
    }
  };

  const regenerateMessage = async (parentMsgId: string) => {
    isGenerating.value = true;
    try {
      const res = await invoke<{ chat_id: string; assistant_msg_id: string }>('regenerate_chat_message', {
        parentMsgId,
        chatId: activeChatId.value,
        project: currentProject,
        modeSlug: activeModeSlug.value
      });
      // Mark all existing assistant children of this parent as inactive in local state
      allMessages.value.forEach(m => {
        if (m.parent_id === parentMsgId && m.role === 'assistant') {
          m.is_active = false;
        }
      });
      // Pre-create the new assistant placeholder so stream knows where to attach
      const exists = allMessages.value.find(m => m.id === res.assistant_msg_id);
      if (!exists) {
        allMessages.value.push({
          id: res.assistant_msg_id,
          role: 'assistant',
          content: '',
          reasoning: '',
          toolLogs: [],
          parent_id: parentMsgId,
          is_active: true
        });
      }
      console.log('[REGEN] new assistant_msg_id:', res.assistant_msg_id, 'parent:', parentMsgId);
    } catch(e) {
      console.error('Failed to regenerate', e);
      isGenerating.value = false;
    }
  };

  const switchVariant = async (msgId: string) => {
    try {
      await invoke('switch_message_variant', { msgId });
      await loadMessages(activeChatId.value);
    } catch(e) {
      console.error('Failed to switch variant', e);
    }
  };

  // Вычисляем активную ветку
  const renderedMessages = computed<MessageVariantGroup[]>(() => {
    const groups: MessageVariantGroup[] = [];
    
    // Находим все корневые сообщения (нет parent_id или parent_id не существует в массиве)
    const validIds = new Set(allMessages.value.map(m => m.id));
    const isRoot = (m: ChatMessage) => !m.parent_id || !validIds.has(m.parent_id) || m.parent_id === 'NONE';
    
    let currentVariants = allMessages.value.filter(isRoot);
    
    while (currentVariants.length > 0) {
      let activeIndex = currentVariants.findIndex(m => m.is_active !== false);
      if (activeIndex === -1) activeIndex = currentVariants.length - 1; // Fallback
      
      const activeMessage = currentVariants[activeIndex];
      groups.push({
        variants: currentVariants,
        activeIndex,
        activeMessage
      });
      
      // Ищем детей активного сообщения
      currentVariants = allMessages.value.filter(m => m.parent_id === activeMessage.id);
    }
    
    return groups;
  });

  return {
    allMessages,
    renderedMessages,
    isGenerating,
    tokenUsage,
    sendMessage,
    loadMessages,
    cancelGeneration,
    deleteMessage,
    editMessage,
    regenerateMessage,
    switchVariant
  };
}

import { ref, type Ref, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCallWaiting?: any;
}

export function useWowilonPanel(
  activeChatId: Ref<string> = ref(''),
  currentProject: string = ''
) {
  const messages = ref<ChatMessage[]>([]);
  const isGenerating = ref(false);
  let unlistenChunk: UnlistenFn | null = null;

  onMounted(async () => {
    unlistenChunk = await listen<any>('chat_stream_chunk', (event) => {
      const chunk = event.payload;
      if (chunk.chat_id === activeChatId.value) {
        const msg = messages.value.find(m => m.id === chunk.message_id);
        if (msg) {
          msg.content = chunk.text;
        } else {
          messages.value.push({
            id: chunk.message_id,
            role: 'assistant',
            content: chunk.text
          });
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
        messages.value = [];
        return;
      }
      const data = await invoke<any[]>('get_chat_messages', { chatId });
      messages.value = data.map(m => ({
        id: m.id,
        role: m.role || 'user',
        content: m.content || '',
      }));
    } catch(e) {
      console.error('Failed to load messages', e);
      messages.value = [];
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Оптимистично пушим пользовательское сообщение
    messages.value.push({ role: 'user', content: text });
    isGenerating.value = true;

    try {
      const res = await invoke<{ chat_id: string; assistant_msg_id: string }>('send_chat_message', {
        chatId: activeChatId.value,
        text: text,
        project: currentProject
      });

      // Бэкенд мог создать новый чат — переключаемся на него
      if (res.chat_id && res.chat_id !== activeChatId.value) {
        activeChatId.value = res.chat_id;
        // We do NOT await loadMessages here because we already have the optimistic state
      }

      // Создаем пустую заглушку для ассистента в UI только если её ещё нет
      const exists = messages.value.find(m => m.id === res.assistant_msg_id);
      if (!exists) {
        messages.value.push({
          id: res.assistant_msg_id,
          role: 'assistant',
          content: ''
        });
      }
    } catch(e) {
      console.error('Failed to send message', e);
      isGenerating.value = false;
    }
  };

  return {
    messages,
    isGenerating,
    sendMessage,
    loadMessages
  };
}

import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';

export interface AiChat {
  id: string;
  title: string;
  tag?: string;
  parent_chat_id?: string;
  created_at?: string;
}

export interface AiChatTreeNode extends AiChat {
  children?: AiChatTreeNode[];
}

export function useAiChats(currentProject: string) {
  const chats = ref<AiChat[]>([]);
  const activeChatId = ref<string>('');
  const isLoading = ref(false);

  const loadChats = async () => {
    isLoading.value = true;
    try {
      const data = await invoke<AiChat[]>('get_chat_tree', { projectId: currentProject });
      chats.value = data.map(c => ({
        id: c.id,
        title: c.title,
        tag: c.tag,
        parent_chat_id: c.parent_chat_id,
        created_at: c.created_at
      }));
    } catch (err) {
      console.error('Failed to load chats:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const createNewChat = async () => {
    // Временный (Transient) чат - не сохраняем в БД сразу
    activeChatId.value = '';
    // Мы можем опционально сбросить какие-то стейты, если нужно
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    try {
      const chat = chats.value.find(c => c.id === chatId);
      if (!chat) return;
      
      const payload = {
        id: chat.id,
        title: newTitle,
        project_id: currentProject,
        parent_chat_id: chat.parent_chat_id || undefined,
        tag: chat.tag || undefined,
        session_context: []
      };
      
      await invoke('save_chat', {
        data: payload
      });
      await loadChats();
    } catch (err) {
      console.error('Failed to rename chat:', err);
    }
  };

  const deleteChats = async (chatIds: string[]) => {
    try {
      for (const id of chatIds) {
        await invoke('delete_ai_chat', {
          project: currentProject,
          id: id
        });
      }
      if (chatIds.includes(activeChatId.value)) {
        activeChatId.value = '';
      }
      await loadChats();
    } catch (err) {
      console.error('Failed to delete chats:', err);
    }
  };

  const branchChat = async (messageId: string, newTitle: string = 'Новая ветка') => {
    try {
      const newChat = await invoke<{ id: string }>('fork_chat', {
        projectId: currentProject,
        messageId,
        newTitle
      });
      await loadChats(); // Reload to get the updated list
      activeChatId.value = newChat.id;
    } catch (err) {
      console.error('Failed to branch chat:', err);
      const { appAlert } = await import('@worldwiki/components');
      appAlert('Ошибка при ветвлении чата: ' + err);
    }
  };

  const updateChatParent = async (chatId: string, newParentId: string | null) => {
    try {
      // Optimistic update
      const chat = chats.value.find(c => c.id === chatId);
      if (chat) {
        chat.parent_chat_id = newParentId || undefined;
      }
      
      await invoke('update_chat_parent', {
        chatId,
        newParentId
      });
      // Optionally reload from backend
    } catch (err) {
      console.error('Failed to update chat parent:', err);
      await loadChats(); // Revert on failure
    }
  };

  const chatTree = computed(() => {
    // Build tree
    const map = new Map<string, AiChatTreeNode>();
    const roots: AiChatTreeNode[] = [];

    // Initialize map
    for (const chat of chats.value) {
      map.set(chat.id, { ...chat, children: [] });
    }

    // Build hierarchy
    for (const chat of map.values()) {
      if (chat.parent_chat_id && map.has(chat.parent_chat_id)) {
        map.get(chat.parent_chat_id)!.children!.push(chat);
      } else {
        roots.push(chat);
      }
    }

    // Sort roots by created_at desc (newest first)
    roots.sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA; // Descending
    });

    return roots;
  });

  return {
    chats,
    activeChatId,
    chatTree,
    isLoading,
    loadChats,
    createNewChat,
    branchChat,
    updateChatParent,
    renameChat,
    deleteChats
  };
}

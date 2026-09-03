import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import MarkdownIt from 'markdown-it';
import type { ToolCallPayload } from './components/AiToolApproval.vue';
import { useAiChats } from './composables/useAiChats';
import { useAiProfiles } from './composables/useAiProfiles';
import type { ContextItem } from './components/AiContextSelector.vue';
import type { AiTopBarMode } from './components/AiChatTopBar.vue';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  toolLogs?: string[];
  toolCallWaiting?: ToolCallPayload | null;
  parent_id?: string | null;
  is_active?: boolean;
}

export interface MessageVariantGroup {
  variants: ChatMessage[];
  activeIndex: number;
  activeMessage: ChatMessage;
}

export interface WowilonPanelProps {
  isOpen: boolean;
}

export interface WowilonPanelEmits {
  (e: 'close'): void;
}

export function useWowilonPanel(
  props: WowilonPanelProps,
  emit: WowilonPanelEmits
) {
  const savedWidth = Number(localStorage.getItem('worldwiki_ai_panel_width') || '400');
  const panelWidth = ref(Number.isNaN(savedWidth) ? 400 : Math.max(300, Math.min(1200, savedWidth)));
  const showSidebar = ref(localStorage.getItem('worldwiki_ai_show_sidebar') === 'true');
  const isSettingsOpen = ref(localStorage.getItem('worldwiki_ai_settings_open') === 'true');
  const selectedContext = ref<ContextItem[]>([]);

  watch(panelWidth, (w) => localStorage.setItem('worldwiki_ai_panel_width', String(w)));
  watch(showSidebar, (v) => localStorage.setItem('worldwiki_ai_show_sidebar', String(v)));
  watch(isSettingsOpen, (v) => localStorage.setItem('worldwiki_ai_settings_open', String(v)));

  let currentProject = 'global';
  const hash = window.location.hash;
  if (hash.includes('?')) {
    const hashParams = new URLSearchParams(hash.split('?')[1]);
    const p = hashParams.get('project');
    if (p) currentProject = p.includes(':') ? p : `projects:${p}`;
  } else {
    const searchParams = new URLSearchParams(window.location.search);
    const p = searchParams.get('project');
    if (p) currentProject = p.includes(':') ? p : `projects:${p}`;
  }

  const md = new MarkdownIt({ html: true, breaks: true, linkify: true });

  const {
    chatTree,
    activeChatId,
    isLoading: isChatsLoading,
    loadChats,
    createNewChat,
    updateChatParent,
    renameChat,
    deleteChats
  } = useAiChats(currentProject);

  const { activeProfile, loadProfiles } = useAiProfiles(currentProject);

  const activeModeSlug = ref(localStorage.getItem(`worldwiki_ai_active_mode_${currentProject}`) || 'chat');
  const modes = ref<AiTopBarMode[]>([]);

  const handleModeChange = (mode: string) => {
    activeModeSlug.value = mode;
  };

  const toggleSidebar = () => {
    showSidebar.value = !showSidebar.value;
  };

  watch(activeModeSlug, (m) => localStorage.setItem(`worldwiki_ai_active_mode_${currentProject}`, m));

  const allMessages = ref<ChatMessage[]>([]);
  const isGenerating = ref(false);
  const tokenUsage = ref({ input_tokens: 0, output_tokens: 0, total_tokens: 0 });
  let unlistenChunk: UnlistenFn | null = null;

  const editingMessageId = ref<string | null>(null);
  const editDraft = ref('');
  const isSending = ref(false);

  const messagesListRef = ref<{ containerRef: HTMLElement | null } | null>(null);
  const messagesContainer = computed(() => messagesListRef.value?.containerRef || null);
  const chatInputRef = ref<{ unlock: () => void } | null>(null);

  const loadMessages = async (chatId: string) => {
    try {
      if (!chatId) {
        allMessages.value = [];
        return;
      }
      const data = await invoke<Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content?: string;
        reasoning?: string;
        tool_logs?: string[];
        parent_id?: string | null;
        is_active?: boolean;
      }>>('get_chat_messages', { chatId });
      const loaded: ChatMessage[] = data.map(m => ({
        id: m.id,
        role: m.role || 'user',
        content: m.content || '',
        reasoning: m.reasoning,
        toolLogs: m.tool_logs,
        parent_id: m.parent_id,
        is_active: m.is_active
      }));
      allMessages.value = loaded;
    } catch (err) {
      console.error('Failed to load chat messages:', err);
      allMessages.value = [];
    }
  };

  const cancelGeneration = async () => {
    try {
      await invoke('cancel_generation', { chatId: activeChatId.value });
      isGenerating.value = false;
    } catch (err) {
      console.error('Failed to cancel generation:', err);
    }
  };

  const deleteMessage = async (msgId: string) => {
    try {
      await invoke('delete_chat_message', { messageId: msgId });
      allMessages.value = allMessages.value.filter(m => m.id !== msgId);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const editMessage = async (msgId: string, newContent: string) => {
    try {
      await invoke('edit_chat_message', { messageId: msgId, newContent });
      const msg = allMessages.value.find(m => m.id === msgId);
      if (msg) msg.content = newContent;
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const regenerateMessage = async (msgId: string) => {
    try {
      isGenerating.value = true;
      await invoke('regenerate_chat_message', {
        chatId: activeChatId.value,
        messageId: msgId,
        modeSlug: activeModeSlug.value
      });
    } catch (err) {
      console.error('Failed to regenerate message:', err);
      isGenerating.value = false;
    }
  };

  const switchVariant = async (msgId: string) => {
    try {
      await invoke('switch_message_variant', { messageId: msgId });
      if (activeChatId.value) {
        await loadMessages(activeChatId.value);
      }
    } catch (err) {
      console.error('Failed to switch variant:', err);
    }
  };

  const triggerSend = async (text: string) => {
    if (!text.trim() || !activeChatId.value) return;
    isGenerating.value = true;
    allMessages.value.push({
      role: 'user',
      content: text
    });
    try {
      await invoke('send_chat_message', {
        chatId: activeChatId.value,
        message: text,
        modeSlug: activeModeSlug.value,
        context: selectedContext.value
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      isGenerating.value = false;
    }
  };

  const renderedMessages = computed<MessageVariantGroup[]>(() => {
    const groups: MessageVariantGroup[] = [];
    for (const msg of allMessages.value) {
      groups.push({
        variants: [msg],
        activeIndex: 0,
        activeMessage: msg
      });
    }
    return groups;
  });

  const startEdit = (msg: ChatMessage) => {
    editingMessageId.value = msg.id || null;
    editDraft.value = msg.content;
  };

  const cancelEdit = () => {
    editingMessageId.value = null;
    editDraft.value = '';
  };

  const saveEdit = (id: string) => {
    if (editDraft.value.trim() && id) {
      void editMessage(id, editDraft.value);
    }
    cancelEdit();
  };

  const scrollToBottom = () => {
    void nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    });
  };

  const saveScroll = () => {
    if (messagesContainer.value && activeChatId.value) {
      localStorage.setItem(`worldwiki_ai_scroll_${activeChatId.value}`, String(messagesContainer.value.scrollTop));
    }
  };

  const restoreScroll = () => {
    void nextTick(() => {
      if (messagesContainer.value && activeChatId.value) {
        const saved = localStorage.getItem(`worldwiki_ai_scroll_${activeChatId.value}`);
        if (saved !== null) {
          messagesContainer.value.scrollTop = parseFloat(saved);
        } else {
          scrollToBottom();
        }
      }
    });
  };

  watch(activeChatId, (newId) => {
    if (newId) {
      if (isGenerating.value && allMessages.value.length > 0) {
        return;
      }
      void loadMessages(newId).then(() => {
        restoreScroll();
      });
    } else {
      allMessages.value = [];
    }
  }, { immediate: true });

  watch(() => props.isOpen, (newVal) => {
    if (newVal && !activeChatId.value) {
      void createNewChat();
    }
  });

  watch(() => allMessages.value.length, () => {
    scrollToBottom();
  });

  const renderMarkdown = (text: string) => {
    return md.render(text);
  };

  const getChatTitle = (chatId: string): string => {
    return chatId.replace('chats:', '');
  };

  const closePanel = () => {
    emit('close');
  };

  const sendMessage = async (text: string) => {
    if (isSending.value || isGenerating.value || !text.trim()) return;

    isSending.value = true;
    try {
      await triggerSend(text);
      await loadChats();
      scrollToBottom();
    } finally {
      isSending.value = false;
      chatInputRef.value?.unlock();
    }
  };

  const selectChat = (id: string) => {
    activeChatId.value = id;
  };

  const handleBranch = async (messageId: string | undefined) => {
    const { appAlert } = await import('@worldwiki/components');
    if (!messageId) {
      appAlert('Это сообщение пока не имеет ID для ветвления.');
      return;
    }
    try {
      const newChat = await invoke<{ id: string }>('fork_chat', {
        projectId: currentProject,
        messageId,
        newTitle: 'Новая ветка'
      });

      if (newChat && newChat.id) {
        activeChatId.value = newChat.id;
      }

      await loadChats();

      const wasOpen = showSidebar.value;
      if (wasOpen) {
        showSidebar.value = false;
        void nextTick(() => {
          showSidebar.value = true;
        });
      }
    } catch (err) {
      console.error('Failed to branch chat:', err);
      appAlert('Ошибка при ветвлении чата: ' + err);
    }
  };

  const handleContextSelected = (contexts: ContextItem[]) => {
    selectedContext.value = [...selectedContext.value, ...contexts];
  };

  const removeContext = (ctx: ContextItem) => {
    selectedContext.value = selectedContext.value.filter(c => c.id !== ctx.id);
  };

  const handleToolApproval = (data: unknown) => {
    console.log('Tool approved:', data);
  };

  const handleToolRejection = (data: unknown) => {
    console.log('Tool rejected:', data);
  };

  const startResize = (e: MouseEvent) => {
    const startX = e.clientX;
    const startWidth = panelWidth.value;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(300, Math.min(800, startWidth + delta));
      panelWidth.value = newWidth;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const detachWindow = async () => {
    emit('close');
    try {
      const params = new URLSearchParams();
      if (activeChatId.value) params.set('chatId', activeChatId.value);
      if (currentProject) params.set('project', currentProject);
      const url = `ai.html?${params.toString()}`;

      const webview = new WebviewWindow('wowilon-ai', {
        url,
        title: 'WoWiLon AI',
        width: 800,
        height: 600,
        resizable: true,
        minWidth: 400,
        minHeight: 400,
        center: true
      });

      webview.once('tauri://error', (e) => {
        console.error('Error creating AI window:', e);
      });
    } catch (e) {
      console.error('Failed to create AI window:', e);
    }
  };

  onMounted(async () => {
    await loadChats();
    loadProfiles();

    try {
      const res = await invoke<AiTopBarMode[]>('get_aimodes', { project: currentProject });
      if (res && res.length > 0) {
        modes.value = res;
      } else {
        modes.value = [{ slug: 'chat', name: 'Собеседник' }, { slug: 'edit', name: 'Редактор' }, { slug: 'analyze', name: 'Аналитик' }];
      }
    } catch (e) {
      console.error("Failed to load modes", e);
      modes.value = [{ slug: 'chat', name: 'Собеседник' }, { slug: 'edit', name: 'Редактор' }, { slug: 'analyze', name: 'Аналитик' }];
    }

    unlistenChunk = await listen<{
      chat_id: string;
      message_id: string;
      chunk_type?: string;
      text: string;
      is_done?: boolean;
    }>('chat_stream_chunk', (event) => {
      const chunk = event.payload;
      if (chunk.chat_id === activeChatId.value) {
        const msg = allMessages.value.find(m => m.id === chunk.message_id);
        if (!msg) {
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
          } catch {
            // ignore
          }
        } else {
          msg.content = (msg.content || '') + chunk.text;
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

  return {
    panelWidth,
    showSidebar,
    isSettingsOpen,
    selectedContext,
    activeProfile,
    activeModeSlug,
    modes,
    chatTree,
    activeChatId,
    isChatsLoading,
    currentProject,
    tokenUsage,
    messages: allMessages,
    renderedMessages,
    isGenerating,
    editingMessageId,
    editDraft,
    messagesListRef,
    chatInputRef,
    handleModeChange,
    toggleSidebar,
    cancelGeneration,
    createNewChat,
    updateChatParent,
    renameChat,
    deleteChats,
    selectChat,
    renderMarkdown,
    getChatTitle,
    saveScroll,
    switchVariant,
    startEdit,
    cancelEdit,
    saveEdit,
    regenerateMessage,
    handleBranch,
    deleteMessage,
    handleToolApproval,
    handleToolRejection,
    sendMessage,
    loadMessages,
    handleContextSelected,
    removeContext,
    startResize,
    closePanel,
    detachWindow
  };
}

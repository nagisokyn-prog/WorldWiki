<template>
  <div class="wowilon-panel" :class="{ 'is-open': isOpen }" :style="{ width: panelWidth + 'px' }">
    <div class="wowilon-resize-handle" @mousedown.prevent="startResize"></div>
    
    <!-- SETTINGS VIEW -->
    <AiSettingsView 
      v-if="isSettingsOpen" 
      @close="isSettingsOpen = false" 
    />
    
    <!-- MAIN CHAT VIEW -->
    <div v-else class="wowilon-inner">
      <AiHeader 
        :active-profile="activeProfile"
        @close="closePanel" 
        @detach="detachWindow" 
        @open-settings="isSettingsOpen = true" 
      />

      <div class="wowilon-body">
        <AiChatHistory 
          v-if="showSidebar" 
          :chat-tree="chatTree"
          :active-chat-id="activeChatId"
          :is-loading="isChatsLoading"
          @select-chat="selectChat"
          @new-chat="createNewChat"
          @move-chat="updateChatParent"
          @rename-chat="renameChat"
          @delete-chats="deleteChats"
        />

        <div class="wowilon-chat-area">
          <AiChatTopBar 
            :active-profile="activeProfile" 
            :token-usage="tokenUsage"
            :modes="modes"
            :active-mode-slug="activeModeSlug"
            :current-project="currentProject"
            @change-mode="handleModeChange"
            @toggle-sidebar="toggleSidebar"
            @restart-session="cancelGeneration"
          />
          
          <AiMessageList 
            ref="messagesListRef"
            v-model:edit-draft="editDraft"
            :messages="messages"
            :rendered-messages="renderedMessages"
            :active-chat-id="activeChatId"
            :chat-title="getChatTitle(activeChatId)"
            :editing-message-id="editingMessageId"
            :render-markdown="renderMarkdown"
            @scroll="saveScroll"
            @switch-variant="switchVariant"
            @start-edit="startEdit"
            @cancel-edit="cancelEdit"
            @save-edit="saveEdit"
            @regenerate="regenerateMessage"
            @branch="handleBranch"
            @delete="deleteMessage"
            @tool-approve="handleToolApproval"
            @tool-reject="handleToolRejection"
          />

          <div class="chat-input-container">
            <AiActionButtons 
              :is-generating="isGenerating"
              :has-error="false"
              :can-resume="false"
              @cancel="cancelGeneration"
              @unload-models="handleEmergencyUnload"
              @retry="handleRetry"
              @resume="handleResume"
            />
            <div class="context-bar">
              <AiContextSelector @context-selected="handleContextSelected" />
              <!-- Show selected context pills here -->
              <div v-if="selectedContext.length > 0" class="context-pills">
                <span v-for="ctx in selectedContext" :key="ctx.id" class="context-pill">
                  {{ ctx.title }}
                  <button @click="removeContext(ctx)"><i class="fas fa-times"></i></button>
                </span>
              </div>
            </div>
            <AiChatInput ref="chatInputRef" :loading="isGenerating || isSending" @submit="sendMessage" @cancel="cancelGeneration" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';
import AiChatInput from './components/AiChatInput.vue';
import AiHeader from './components/AiHeader.vue';
import AiChatHistory from './components/AiChatHistory.vue';
import AiChatTopBar from './components/AiChatTopBar.vue';
import AiActionButtons from './components/AiActionButtons.vue';
import AiContextSelector from './components/AiContextSelector.vue';
import AiMessageList from './components/AiMessageList.vue';
import AiSettingsView from './settings/AiSettingsView.vue';
import { useWowilonPanel, type ChatMessage } from './useWowilonPanel';
import { useAiChats } from './composables/useAiChats';
import { useAiProfiles } from './composables/useAiProfiles';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { ContextItem } from './components/AiContextSelector.vue';
import type { AiTopBarMode } from './components/AiChatTopBar.vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits(['close']);

const savedWidth = parseInt(localStorage.getItem('worldwiki_ai_panel_width') || '400', 10);
const panelWidth = ref(Number.isNaN(savedWidth) ? 400 : Math.max(300, Math.min(1200, savedWidth)));
const showSidebar = ref(localStorage.getItem('worldwiki_ai_show_sidebar') === 'true'); // Toggle chat history
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  chats,
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

const handleRetry = () => {};
const handleResume = () => {};

watch(activeModeSlug, (m) => localStorage.setItem(`worldwiki_ai_active_mode_${currentProject}`, m));

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
  } catch(e) {
    console.error("Failed to load modes", e);
    modes.value = [{ slug: 'chat', name: 'Собеседник' }, { slug: 'edit', name: 'Редактор' }, { slug: 'analyze', name: 'Аналитик' }];
  }
});

const {
  allMessages: messages,
  renderedMessages,
  isGenerating,
  tokenUsage,
  sendMessage: triggerSend,
  loadMessages,
  cancelGeneration,
  deleteMessage,
  editMessage,
  regenerateMessage,
  switchVariant
} = useWowilonPanel(activeChatId, currentProject, activeModeSlug);

const editingMessageId = ref<string | null>(null);
const editDraft = ref('');

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
    editMessage(id, editDraft.value);
  }
  cancelEdit();
};

const isSending = ref(false);

const saveScroll = () => {
  if (messagesContainer.value && activeChatId.value) {
    localStorage.setItem(`worldwiki_ai_scroll_${activeChatId.value}`, String(messagesContainer.value.scrollTop));
  }
};

const restoreScroll = () => {
  nextTick(() => {
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
    if (isGenerating.value && messages.value.length > 0) {
      return; 
    }
    loadMessages(newId).then(() => {
      restoreScroll();
    });
  } else {
    messages.value = [];
  }
}, { immediate: true });

watch(() => props.isOpen, (newVal) => {
  if (newVal && !activeChatId.value) {
    createNewChat();
  }
});

const messagesListRef = ref<{ containerRef: HTMLElement | null } | null>(null);
const messagesContainer = computed(() => messagesListRef.value?.containerRef || null);
const chatInputRef = ref<{ unlock: () => void } | null>(null);

const renderMarkdown = (text: string) => {
  return md.render(text);
};

const getChatTitle = (chatId: string): string => {
  // Try to find chat in sidebar tree
  // For now return the ID if we can't find title
  return chatId.replace('chats:', '');
};

const handleEmergencyUnload = async () => {
  try {
    await cancelGeneration();
    await invoke('unload_all_local_models');
  } catch (err) {
    console.error('Emergency unload failed:', err);
  }
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
    // Unlock the input so it can accept new messages
    chatInputRef.value?.unlock();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

const selectChat = (id: string) => activeChatId.value = id;

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
    
    // Переключаемся на новый чат
    if (newChat && newChat.id) {
      activeChatId.value = newChat.id;
    }
    
    await loadChats();
    
    // Грязный хак: заставляем sidebar обновиться, если он открыт
    // В идеале нужен глобальный стор, но пока сойдет так:
    const wasOpen = showSidebar.value;
    if (wasOpen) {
      showSidebar.value = false;
      nextTick(() => {
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

watch(() => messages.value.length, () => {
  scrollToBottom();
});

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
    // Build URL with current chat and project
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
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/WowilonPanel.css"></style>

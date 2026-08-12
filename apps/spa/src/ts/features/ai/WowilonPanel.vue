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
          <AiChatTopBar :active-profile="activeProfile" :token-usage="tokenUsage" />
          
          <div class="messages-container" ref="messagesContainer">
            <!-- Empty state: no chat selected OR chat selected but no messages -->
            <div v-if="messages.length === 0" class="empty-chat-state">
              <i class="fas fa-comment-dots"></i>
              <p v-if="activeChatId">
                <span class="chat-title-label">Чат: </span>{{ getChatTitle(activeChatId) }}
              </p>
              <p v-else>Выберите чат слева или создайте новый</p>
            </div>
            
            <div 
              v-else
              v-for="(group, idx) in renderedMessages" 
              :key="group.activeMessage.id || idx" 
              class="message-wrapper" 
              :class="'message-' + group.activeMessage.role"
            >
              <div class="message-avatar">
                <i :class="group.activeMessage.role === 'user' ? 'fas fa-user' : 'fas fa-robot'"></i>
              </div>
              <div class="message-content-wrapper" style="flex: 1; min-width: 0;">
                <details v-if="group.activeMessage.reasoning" class="thinking-accordion">
                  <summary>Мысли (Thinking...)</summary>
                  <div class="thinking-content" v-html="renderMarkdown(group.activeMessage.reasoning)"></div>
                </details>
                
                <div v-if="group.activeMessage.toolLogs && group.activeMessage.toolLogs.length > 0" class="tool-logs-container">
                  <div v-for="(log, lIdx) in group.activeMessage.toolLogs" :key="lIdx" class="tool-log-item">
                    <i class="fas fa-wrench"></i> {{ log }}
                  </div>
                </div>

                <div v-if="editingMessageId === group.activeMessage.id" class="inline-editor">
                  <textarea v-model="editDraft" class="inline-editor-textarea"></textarea>
                  <div class="inline-editor-actions">
                    <button class="btn-cancel" @click="cancelEdit">Отмена</button>
                    <button class="btn-save" @click="saveEdit(group.activeMessage.id)">Отправить</button>
                  </div>
                </div>

                <div v-else class="message-content" v-html="renderMarkdown(group.activeMessage.content)"></div>
                
                <div v-if="group.variants.length > 1" class="variant-switcher">
                  <button :disabled="group.activeIndex === 0" @click="switchVariant(group.variants[group.activeIndex - 1].id as string)"><i class="fas fa-chevron-left"></i></button>
                  <span>{{ group.activeIndex + 1 }} / {{ group.variants.length }}</span>
                  <button :disabled="group.activeIndex === group.variants.length - 1" @click="switchVariant(group.variants[group.activeIndex + 1].id as string)"><i class="fas fa-chevron-right"></i></button>
                </div>
              </div>
              
              <div class="message-actions-hover">
                <button v-if="group.activeMessage.role === 'user'" class="icon-btn" title="Редактировать" @click="startEdit(group.activeMessage)">
                  <i class="fas fa-pencil-alt"></i>
                </button>
                <button v-if="group.activeMessage.role === 'assistant'" class="icon-btn" title="Перегенерировать ответ" @click="regenerateMessage(group.activeMessage.parent_id as string)">
                  <i class="fas fa-sync-alt"></i>
                </button>
                <button class="icon-btn" title="Создать ветку отсюда (Fork)" @click="handleBranch(group.activeMessage.id)">
                  <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="14" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M7 8l0 8"></path><path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path><path d="M14 14l3 -3l3 3"></path></svg>
                </button>
                <button class="icon-btn danger" title="Удалить" @click="deleteMessage(group.activeMessage.id as string)">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
              
              <!-- Tool Approval Card -->
              <AiToolApproval 
                v-if="group.activeMessage.toolCallWaiting" 
                :tool-call="group.activeMessage.toolCallWaiting"
                @approve="handleToolApproval"
                @reject="handleToolRejection"
              />
            </div>
          </div>

          <div class="chat-input-container">
            <AiActionButtons 
              :is-generating="isGenerating"
              :has-error="false"
              :can-resume="false"
              @cancel="cancelGeneration"
              @retry="() => {}"
              @resume="() => {}"
            />
            <div class="context-bar">
              <AiContextSelector @context-selected="handleContextSelected" />
              <!-- Show selected context pills here -->
              <div class="context-pills" v-if="selectedContext.length > 0">
                <span class="context-pill" v-for="ctx in selectedContext" :key="ctx.id">
                  {{ ctx.title }}
                  <button @click="removeContext(ctx)"><i class="fas fa-times"></i></button>
                </span>
              </div>
            </div>
            <AiChatInput ref="chatInputRef" @submit="sendMessage" @cancel="cancelGeneration" :loading="isGenerating || isSending" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick, onUnmounted } from 'vue';
import MarkdownIt from 'markdown-it';
import AiChatInput from './AiChatInput.vue';
import AiHeader from './components/AiHeader.vue';
import AiChatHistory from './components/AiChatHistory.vue';
import AiChatTopBar from './components/AiChatTopBar.vue';
import AiActionButtons from './components/AiActionButtons.vue';
import AiContextSelector from './components/AiContextSelector.vue';
import AiToolApproval from './components/AiToolApproval.vue';
import AiSettingsView from './settings/AiSettingsView.vue';
import { useWowilonPanel } from './useWowilonPanel';
import { useAiChats } from './composables/useAiChats';
import { useAiProfiles } from './composables/useAiProfiles';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits(['close']);

const panelWidth = ref(400);
const showSidebar = ref(true); // Toggle chat history
const isSettingsOpen = ref(false);
const selectedContext = ref<any[]>([]);

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

onMounted(() => {
  loadChats();
  loadProfiles();
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
} = useWowilonPanel(activeChatId, currentProject);

const editingMessageId = ref<string | null>(null);
const editDraft = ref('');

const startEdit = (msg: any) => {
  editingMessageId.value = msg.id;
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

watch(activeChatId, (newId) => {
  if (newId) {
    if (isGenerating.value && messages.value.length > 0) {
      return; 
    }
    loadMessages(newId);
  } else {
    messages.value = [];
  }
}, { immediate: true });

const messagesContainer = ref<HTMLElement | null>(null);
const chatInputRef = ref<any>(null);

const renderMarkdown = (text: string) => {
  return md.render(text);
};

const getChatTitle = (chatId: string): string => {
  // Try to find chat in sidebar tree
  // For now return the ID if we can't find title
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
  if (!messageId) {
    alert('Это сообщение пока не имеет ID для ветвления.');
    return;
  }
  try {
    const newChat = await invoke<any>('fork_chat', {
      projectId: currentProject,
      messageId,
      newTitle: 'Новая ветка'
    });
    
    // Переключаемся на новый чат
    if (newChat && newChat.id) {
      activeChatId.value = newChat.id;
    }
    
    // Грязный хак: заставляем sidebar обновиться, если он открыт
    // В идеале нужен глобальный стор, но пока сойдет так:
    showSidebar.value = false;
    nextTick(() => {
      showSidebar.value = true;
    });
  } catch (err) {
    console.error('Failed to branch chat:', err);
    alert('Ошибка при ветвлении чата: ' + err);
  }
};

const handleContextSelected = (contexts: any[]) => {
  selectedContext.value = [...selectedContext.value, ...contexts];
};

const removeContext = (ctx: any) => {
  selectedContext.value = selectedContext.value.filter(c => c.id !== ctx.id);
};

const handleToolApproval = (data: any) => {
  console.log('Tool approved:', data);
};

const handleToolRejection = (data: any) => {
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

// ===== GLOBAL CLICK LOGGING FOR MAIN CHAT PANEL =====
const logPanelClick = (event: Event) => {
  const mouseEvent = event as MouseEvent;
  const target = event.target as HTMLElement;
  const tagName = target.tagName.toLowerCase();
  const className = target.className || '(no class)';
  const id = target.id || '(no id)';
  const textContent = target.textContent?.trim().slice(0, 100) || '(empty)';
  const x = mouseEvent.clientX;
  const y = mouseEvent.clientY;
  const chatId = activeChatId.value;
  const project = currentProject;
  
  console.log(`[PANEL-CLICK] chatId=${chatId} project=${project} | (${x}, ${y}) | <${tagName}>.#${id}.${className} | "${textContent}"`, {
    target,
    tagName,
    className,
    id,
    textContent,
    x,
    y,
    chatId,
    project,
    timestamp: Date.now(),
    path: event.composedPath().map((el: any) => el.tagName?.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className : '')).filter(Boolean).join(' > ')
  });
};

onMounted(() => {
  const container = document.querySelector('.wowilon-panel');
  const listener = logPanelClick as EventListener;
  if (container) {
    container.addEventListener('click', listener, true);
    console.log('[PANEL-CLICK] Global click listener attached to .wowilon-panel');
  } else {
    console.warn('[PANEL-CLICK] .wowilon-panel not found, attaching to document');
    document.addEventListener('click', listener, true);
  }
  (window as any).__panelClickListener = { container, listener };
});

onUnmounted(() => {
  const stored = (window as any).__panelClickListener;
  if (stored?.container) {
    stored.container.removeEventListener('click', stored.listener, true);
  } else if (stored?.listener) {
    document.removeEventListener('click', stored.listener, true);
  }
  console.log('[PANEL-CLICK] Global click listener removed');
});
</script>

<style scoped src="./WowilonPanel.vue.css"></style>

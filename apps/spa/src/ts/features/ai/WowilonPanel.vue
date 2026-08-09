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
        @close="closePanel" 
        @detach="detachWindow" 
        @open-settings="isSettingsOpen = true" 
      />

      <div class="wowilon-body">
        <AiChatHistory 
          v-if="showSidebar" 
          :active-chat-id="activeChatId"
          @select-chat="selectChat"
          @new-chat="createNewChat"
        />

        <div class="wowilon-chat-area">
          <div class="messages-container" ref="messagesContainer">
            <div v-if="messages.length === 0" class="empty-chat-state">
              <i class="fas fa-comment-dots"></i>
              <p>Чем могу помочь сегодня?</p>
            </div>
            
            <div 
              v-for="(msg, idx) in messages" 
              :key="idx" 
              class="message-wrapper" 
              :class="'message-' + msg.role"
            >
              <div class="message-avatar">
                <i :class="msg.role === 'user' ? 'fas fa-user' : 'fas fa-robot'"></i>
              </div>
              <div class="message-content" v-html="renderMarkdown(msg.content)"></div>
              
              <!-- Tool Approval Card -->
              <AiToolApproval 
                v-if="msg.toolCallWaiting" 
                :tool-call="msg.toolCallWaiting"
                @approve="handleToolApproval"
                @reject="handleToolRejection"
              />
            </div>
          </div>

          <div class="chat-input-container">
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
            <AiChatInput @submit="sendMessage" :loading="isGenerating" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';
import AiChatInput from './AiChatInput.vue';
import AiHeader from './components/AiHeader.vue';
import AiChatHistory from './components/AiChatHistory.vue';
import AiContextSelector from './components/AiContextSelector.vue';
import AiToolApproval from './components/AiToolApproval.vue';
import AiSettingsView from './settings/AiSettingsView.vue';
import { useWowilonPanel } from './useWowilonPanel';
import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits(['close']);

const panelWidth = ref(400);
const showSidebar = ref(true); // Toggle chat history
const isSettingsOpen = ref(false);
const activeChatId = ref('1');
const selectedContext = ref<any[]>([]);

const md = new MarkdownIt({ html: true, breaks: true, linkify: true });

const {
  messages,
  isGenerating,
  sendMessage: triggerSend
} = useWowilonPanel();

const messagesContainer = ref<HTMLElement | null>(null);

const renderMarkdown = (text: string) => {
  return md.render(text);
};

const closePanel = () => {
  emit('close');
};

const sendMessage = async (text: string) => {
  await triggerSend(text);
  scrollToBottom();
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

const selectChat = (id: string) => activeChatId.value = id;
const createNewChat = () => alert('New chat created');

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
    const webview = new WebviewWindow('wowilon-ai', {
      url: 'ai.html',
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

<style scoped src="./WowilonPanel.vue.css"></style>

<template>
  <div class="wowilon-app-container">
    <!-- SETTINGS VIEW -->
    <AiSettingsView 
      v-if="isSettingsOpen" 
      @close="isSettingsOpen = false" 
    />
    
    <!-- MAIN CHAT VIEW -->
    <div v-else class="wowilon-app-inner">
      <AiHeader 
        :is-detached="true" 
        @open-settings="isSettingsOpen = true" 
      />

      <div class="wowilon-body">
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
          </div>
        </div>

        <div class="chat-input-container">
          <AiChatInput @submit="handleSend" :loading="isGenerating" />
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';
import AiChatInput from './features/ai/AiChatInput.vue';
import AiHeader from './features/ai/components/AiHeader.vue';
import AiSettingsView from './features/ai/settings/AiSettingsView.vue';
import { useWowilonPanel } from './features/ai/useWowilonPanel';

const isSettingsOpen = ref(false);

const md = new MarkdownIt({ html: true, breaks: true, linkify: true });
const messagesContainer = ref<HTMLElement | null>(null);

const activeChatId = ref('');
const currentProject = ref('');

const { messages, isGenerating, sendMessage } = useWowilonPanel(activeChatId, currentProject.value);

const renderMarkdown = (text: string) => md.render(text);

const handleSend = async (text: string) => {
  await sendMessage(text);
  scrollToBottom();
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

watch(() => messages.value.length, scrollToBottom);
</script>

<style scoped>
.wowilon-app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--bg-main);
}

.wowilon-app-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.wowilon-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.wowilon-chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-chat-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  gap: 12px;
}

.empty-chat-state i {
  font-size: 32px;
  opacity: 0.5;
}

.message-wrapper {
  display: flex;
  gap: 12px;
  max-width: 90%;
}

.message-user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-assistant {
  align-self: flex-start;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface);
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.message-user .message-avatar {
  background: var(--accent);
  color: white;
  border: none;
}

.message-content {
  background: var(--bg-surface);
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-main);
  overflow-x: auto;
}

.message-user .message-content {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.2);
}

.chat-input-container {
  padding: 16px;
  background: var(--bg-panel);
  border-top: 1px solid var(--border-color);
}
</style>

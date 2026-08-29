<template>
  <div class="wowilon-app-container">
    <AppDialog />
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
        <div ref="messagesContainer" class="messages-container">
          <div v-if="renderedMessages.length === 0" class="empty-chat-state">
            <i class="fas fa-comment-dots"></i>
            <p>Чем могу помочь сегодня?</p>
          </div>
          
          <div 
            v-for="(group, idx) in renderedMessages" 
            :key="group.activeMessage.id || idx" 
            class="message-wrapper" 
            :class="'message-' + group.activeMessage.role"
          >
            <div class="message-avatar">
              <i :class="group.activeMessage.role === 'user' ? 'fas fa-user' : 'fas fa-robot'"></i>
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -->
<div class="message-content" v-html="renderMarkdown(group.activeMessage.content)"></div>
          </div>
        </div>

        <div class="chat-input-container">
          <AiChatInput :loading="isGenerating" @submit="handleSend" />
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import MarkdownIt from 'markdown-it';
import { AppDialog } from '@worldwiki/components';
import AiChatInput from '../components/AiChatInput.vue';
import AiHeader from '../components/AiHeader.vue';
import AiSettingsView from '../settings/AiSettingsView.vue';
import { useWowilonPanel } from '../useWowilonPanel';

// Read URL parameters for chatId and project
const searchParams = new URLSearchParams(window.location.search);
const urlChatId = searchParams.get('chatId') || '';
const urlProject = searchParams.get('project') || '';

const isSettingsOpen = ref(false);

const md = new MarkdownIt({ html: true, breaks: true, linkify: true });
const messagesContainer = ref<HTMLElement | null>(null);

// Initialize from URL params
const activeChatId = ref(urlChatId);
const currentProject = ref(urlProject);

const { renderedMessages, isGenerating, sendMessage, loadMessages } = useWowilonPanel(activeChatId, currentProject.value);

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

// Load messages when chatId changes
watch(activeChatId, (newId) => {
  if (newId) loadMessages(newId);
}, { immediate: true });

watch(() => renderedMessages.value.length, scrollToBottom);

// ===== GLOBAL CLICK LOGGING FOR CHAT WINDOW =====
const logClick = (event: Event) => {
  const mouseEvent = event as MouseEvent;
  const target = event.target as HTMLElement;
  const tagName = target.tagName.toLowerCase();
  const className = target.className || '(no class)';
  const id = target.id || '(no id)';
  const textContent = target.textContent?.trim().slice(0, 100) || '(empty)';
  const x = mouseEvent.clientX;
  const y = mouseEvent.clientY;
  const chatId = activeChatId.value;
  const project = currentProject.value;
  
  console.log(`[CHAT-CLICK] chatId=${chatId} project=${project} | (${x}, ${y}) | <${tagName}>.#${id}.${className} | "${textContent}"`, {
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
    path: event.composedPath().map((el) => {
      const elem = el as HTMLElement;
      return elem.tagName?.toLowerCase() + (elem.id ? '#' + elem.id : '') + (elem.className && typeof elem.className === 'string' ? '.' + elem.className : '');
    }).filter(Boolean).join(' > ')
  });
};

onMounted(() => {
  // Attach to the root container
  const container = document.querySelector('.wowilon-app-container');
   
  const listener = logClick;
  if (container) {
    container.addEventListener('click', listener, true); // capture phase
    console.log('[CHAT-CLICK] Global click listener attached to .wowilon-app-container');
  } else {
    console.warn('[CHAT-CLICK] .wowilon-app-container not found, attaching to document');
    document.addEventListener('click', listener, true);
  }
  
  // Store for cleanup
  (window as unknown as { __chatClickListener?: { container: Element | null; listener: (e: Event) => void } }).__chatClickListener = { container, listener };
});

onUnmounted(() => {
  const stored = (window as unknown as { __chatClickListener?: { container: Element | null; listener: (e: Event) => void } }).__chatClickListener;
  if (stored?.container) {
    stored.container.removeEventListener('click', stored.listener, true);
  } else if (stored?.listener) {
    document.removeEventListener('click', stored.listener, true);
  }
  console.log('[CHAT-CLICK] Global click listener removed');
});
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiApp.css"></style>

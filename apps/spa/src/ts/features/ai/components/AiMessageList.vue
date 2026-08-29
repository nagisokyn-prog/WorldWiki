<template>
  <div ref="containerRef" class="messages-container" @scroll="$emit('scroll', $event)">
    <!-- Пустое состояние -->
    <div v-if="messages.length === 0" class="empty-chat-state">
      <i class="fas fa-comment-dots"></i>
      <p v-if="activeChatId">
        <span class="chat-title-label">Чат: </span>{{ chatTitle }}
      </p>
      <p v-else>Выберите чат слева или создайте новый</p>
    </div>
    
    <!-- Список сообщений с ветвлением -->
    <div 
      v-for="(group, idx) in renderedMessages"
      v-else 
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
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="thinking-content" v-html="renderMarkdown(group.activeMessage.reasoning)"></div>
        </details>
        
        <div v-if="group.activeMessage.toolLogs && group.activeMessage.toolLogs.length > 0" class="tool-logs-container">
          <div 
            v-for="(log, lIdx) in group.activeMessage.toolLogs" 
            :key="lIdx" 
            class="tool-log-item" 
            :class="{ 'subagent-log': log.includes('spawn_subagent') }"
          >
            <i :class="log.includes('spawn_subagent') ? 'fas fa-robot subagent-icon' : 'fas fa-wrench'"></i> {{ log }}
          </div>
        </div>

        <div v-if="editingMessageId === group.activeMessage.id" class="inline-editor">
          <textarea 
            :value="editDraft" 
            class="inline-editor-textarea"
            @input="$emit('update:editDraft', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <div class="inline-editor-actions">
            <button class="btn-cancel" @click="$emit('cancel-edit')">Отмена</button>
            <button class="btn-save" @click="$emit('save-edit', group.activeMessage.id as string)">Отправить</button>
          </div>
        </div>

        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else class="message-content" v-html="renderMarkdown(group.activeMessage.content)"></div>
        
        <div v-if="group.variants.length > 1" class="variant-switcher">
          <button :disabled="group.activeIndex === 0" @click="$emit('switch-variant', group.variants[group.activeIndex - 1].id as string)">
            <i class="fas fa-chevron-left"></i>
          </button>
          <span>{{ group.activeIndex + 1 }} / {{ group.variants.length }}</span>
          <button :disabled="group.activeIndex === group.variants.length - 1" @click="$emit('switch-variant', group.variants[group.activeIndex + 1].id as string)">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
      
      <div class="message-actions-hover">
        <button v-if="group.activeMessage.role === 'user'" class="icon-btn" title="Редактировать" @click="$emit('start-edit', group.activeMessage)">
          <i class="fas fa-pencil-alt"></i>
        </button>
        <button v-if="group.activeMessage.role === 'assistant'" class="icon-btn" title="Перегенерировать ответ" @click="$emit('regenerate', group.activeMessage.parent_id as string)">
          <i class="fas fa-sync-alt"></i>
        </button>
        <button class="icon-btn" title="Создать ветку отсюда (Fork)" @click="$emit('branch', group.activeMessage.id)">
          <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="14" width="14" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
            <path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
            <path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
            <path d="M7 8l0 8"></path>
            <path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path>
            <path d="M14 14l3 -3l3 3"></path>
          </svg>
        </button>
        <button class="icon-btn danger" title="Удалить" @click="$emit('delete', group.activeMessage.id as string)">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
      
      <!-- Карточка одобрения инструмента -->
      <AiToolApproval 
        v-if="group.activeMessage.toolCallWaiting" 
        :tool-call="group.activeMessage.toolCallWaiting"
        @approve="$emit('tool-approve', $event)"
        @reject="$emit('tool-reject', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ChatMessage, MessageVariantGroup } from '../useWowilonPanel';
import type { ToolCallPayload } from './AiToolApproval.vue';
import AiToolApproval from './AiToolApproval.vue';

defineProps<{
  messages: ChatMessage[];
  renderedMessages: MessageVariantGroup[];
  activeChatId: string;
  chatTitle: string;
  editingMessageId: string | null;
  editDraft: string;
  renderMarkdown: (text: string) => string;
}>();

defineEmits<{
  (e: 'scroll', event: Event): void;
  (e: 'update:editDraft', val: string): void;
  (e: 'switch-variant', msgId: string): void;
  (e: 'start-edit', message: ChatMessage): void;
  (e: 'cancel-edit'): void;
  (e: 'save-edit', messageId: string): void;
  (e: 'regenerate', parentId: string): void;
  (e: 'branch', messageId: string | undefined): void;
  (e: 'delete', messageId: string): void;
  (e: 'tool-approve', payload: ToolCallPayload): void;
  (e: 'tool-reject', payload: ToolCallPayload): void;
}>();

const containerRef = ref<HTMLElement | null>(null);

defineExpose({
  containerRef
});
</script>

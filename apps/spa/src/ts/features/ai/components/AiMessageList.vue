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
    
    <!-- Список сообщений -->
    <div 
      v-for="(group, idx) in renderedMessages"
      v-else 
      :key="group.activeMessage.id || idx" 
      class="message-wrapper" 
      :class="'message-' + group.activeMessage.role"
    >
      <!-- Аватар -->
      <div class="message-avatar">
        <i :class="group.activeMessage.role === 'user' ? 'fas fa-user' : 'fas fa-robot'"></i>
      </div>

      <!-- Контейнер контента сообщения -->
      <div class="message-content-wrapper">
        <!-- Шапка сообщения: имя автора -->
        <div class="message-header">
          <span class="author-badge">
            {{ group.activeMessage.role === 'user' ? 'Вы' : 'WoWiLon AI' }}
          </span>
        </div>

        <!-- Мысли ИИ (рассуждения / Chain of Thought) -->
        <details v-if="group.activeMessage.reasoning" class="thinking-accordion">
          <summary><i class="fas fa-brain"></i> Ход мыслей (Thinking...)</summary>
          <SafeHtml class="thinking-content" :content="renderMarkdown(group.activeMessage.reasoning)" />
        </details>
        
        <!-- Логи вызова инструментов -->
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

        <!-- Пузырь сообщения (Message Bubble) -->
        <div 
          class="message-bubble" 
          :class="{ 'is-error-bubble': group.activeMessage.is_error || isErrorMessage(group.activeMessage.content) }"
        >
          <!-- Режим инлайн-редактирования -->
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

          <!-- Отрендеренный текст сообщения -->
          <SafeHtml v-else class="message-content" :content="renderMarkdown(group.activeMessage.content)" />
        </div>
        
        <!-- Переключатель вариантов ответа (Ветвление) -->
        <div v-if="group.variants.length > 1" class="variant-switcher">
          <button 
            :disabled="group.activeIndex === 0" 
            title="Предыдущий вариант"
            @click="$emit('switch-variant', group.variants[group.activeIndex - 1].id as string)"
          >
            <i class="fas fa-chevron-left"></i>
          </button>
          <span>{{ group.activeIndex + 1 }} / {{ group.variants.length }}</span>
          <button 
            :disabled="group.activeIndex === group.variants.length - 1" 
            title="Следующий вариант"
            @click="$emit('switch-variant', group.variants[group.activeIndex + 1].id as string)"
          >
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>

        <!-- Всплывающая панель быстрых действий -->
        <div class="message-actions-hover">
          <button class="icon-btn" title="Копировать текст" @click="copyText(group.activeMessage.content)">
            <i class="fas fa-copy"></i>
          </button>
          <button 
            v-if="group.activeMessage.role === 'user'" 
            class="icon-btn" 
            title="Редактировать сообщение" 
            @click="$emit('start-edit', group.activeMessage)"
          >
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button 
            v-if="group.activeMessage.role === 'assistant'" 
            class="icon-btn" 
            title="Перегенерировать ответ" 
            @click="$emit('regenerate', group.activeMessage.parent_id as string)"
          >
            <i class="fas fa-sync-alt"></i>
          </button>
          <button class="icon-btn" title="Создать ветку отсюда (Fork)" @click="$emit('branch', group.activeMessage.id)">
            <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="13" width="13" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
              <path d="M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
              <path d="M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
              <path d="M7 8l0 8"></path>
              <path d="M9 18h6a2 2 0 0 0 2 -2v-5"></path>
              <path d="M14 14l3 -3l3 3"></path>
            </svg>
          </button>
          <button class="icon-btn danger" title="Удалить сообщение" @click="$emit('delete', group.activeMessage.id as string)">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>

        <!-- Карточка запроса подтверждения инструмента -->
        <AiToolApproval 
          v-if="group.activeMessage.toolCallWaiting" 
          :tool-call="group.activeMessage.toolCallWaiting"
          @approve="$emit('tool-approve', $event)"
          @reject="$emit('tool-reject', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SafeHtml } from '@worldwiki/components';
import type { ChatMessage, MessageVariantGroup } from '../useWowilonPanel';
import type { ToolCallPayload } from './AiToolApproval.vue';
import AiToolApproval from './AiToolApproval.vue';
import { useAiMessageList } from './useAiMessageList';

export interface AiMessageListProps {
  messages: ChatMessage[];
  renderedMessages: MessageVariantGroup[];
  activeChatId: string;
  chatTitle: string;
  editingMessageId: string | null;
  editDraft: string;
  renderMarkdown: (text: string) => string;
}

export interface AiMessageListEmits {
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
}

defineProps<AiMessageListProps>();
defineEmits<AiMessageListEmits>();

const { containerRef, copyText, isErrorMessage } = useAiMessageList();

defineExpose({
  containerRef
});
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiMessageList.css"></style>

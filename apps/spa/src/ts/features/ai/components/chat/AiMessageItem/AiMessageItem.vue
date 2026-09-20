<template>
  <div 
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
      <details v-if="group.activeMessage.reasoning" class="thinking-accordion" :open="isGenerating">
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
        :data-message-id="group.activeMessage.id"
        :class="{ 'is-error-bubble': group.activeMessage.is_error || isErrorMessage(group.activeMessage.content) }"
      >
        <!-- Прикрепленные навыки/скиллы -->
        <div v-if="getAttachedSkills(group.activeMessage.content).length > 0" class="message-attached-skills">
          <div 
            v-for="(skill, sIdx) in getAttachedSkills(group.activeMessage.content)" 
            :key="sIdx"
            class="ai-skill-pill interactive-el"
            :title="skill.name"
          >
            <div class="ai-skill-pill-icon">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                <path d="M3 2.5C3 1.67 3.67 1 4.5 1H9.5L13 4.5V13.5C13 14.33 12.33 15 11.5 15H4.5C3.67 15 3 14.33 3 13.5V2.5Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9 1V5H13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="ai-skill-pill-label">{{ skill.name || 'skills' }}</span>
          </div>
        </div>

        <!-- Цитата из предыдущего контекста -->
        <div v-if="getExtractedQuote(group.activeMessage)" class="ai-quote-card">
          <div class="ai-quote-card__body">
            <div class="ai-quote-card__header">
              <svg class="ai-quote-icon" viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M6.5 4.5H3.5C2.4 4.5 1.5 5.4 1.5 6.5V9.5C1.5 10.6 2.4 11.5 3.5 11.5H5.5V13.5L8.5 10.5V6.5C8.5 5.4 7.6 4.5 6.5 4.5ZM14.5 4.5H11.5C10.4 4.5 9.5 5.4 9.5 6.5V9.5C9.5 10.6 10.4 11.5 11.5 11.5H13.5V13.5L16.5 10.5V6.5C16.5 5.4 15.6 4.5 14.5 4.5Z"/>
              </svg>
              <span class="ai-quote-label">{{ getExtractedQuote(group.activeMessage)?.name || 'Цитата' }}</span>
            </div>
            <div class="ai-quote-card__text">
              «{{ getExtractedQuote(group.activeMessage)?.content }}»
            </div>
          </div>
        </div>

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

        <!-- Отрендеренный текст сообщения с поддержкой Mermaid диаграмм -->
        <div v-else class="message-content">
          <template v-for="(seg, sIdx) in parseMessageContent(getCleanedContent(group.activeMessage.content, group.activeMessage.quoted_context))" :key="sIdx">
            <AiMermaidDiagram v-if="seg.type === 'mermaid'" :code="seg.content" />
            <SafeHtml v-else class="message-text-segment" :content="renderMarkdown(seg.content)" />
          </template>

          <!-- Список структурных источников/цитат -->
          <div v-if="group.activeMessage.citations && group.activeMessage.citations.length > 0" class="message-citations-footer">
            <div class="citations-title">Источники и факты:</div>
            <div class="citations-list">
              <AiCitationBadge
                v-for="(cit, cIdx) in group.activeMessage.citations"
                :key="cIdx"
                :citation="cit"
                @ask-source="$emit('ask-source', $event)"
              />
            </div>
          </div>
        </div>
      </div>
      
      <!-- Переключатель вариантов ответа -->
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
</template>

<script setup lang="ts">
import { SafeHtml } from '@worldwiki/components';
import AiToolApproval from '../../tools/AiToolApproval/AiToolApproval.vue';
import AiMermaidDiagram from '../../visuals/AiMermaidDiagram/AiMermaidDiagram.vue';
import AiCitationBadge from '../../citations/AiCitationBadge/AiCitationBadge.vue';
import type { AiMessageItemProps, AiMessageItemEmits } from './AiMessageItem.model';
import { useAiMessageList } from '../AiMessageList/useAiMessageList';

defineProps<AiMessageItemProps>();
defineEmits<AiMessageItemEmits>();

const {
  copyText,
  isErrorMessage,
  getAttachedSkills,
  getExtractedQuote,
  getCleanedContent,
  parseMessageContent
} = useAiMessageList();
</script>

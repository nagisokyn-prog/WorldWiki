<template>
  <div class="chat-input-container">
    <AiActionButtons 
      :is-generating="isGenerating"
      :has-error="hasError"
      :can-resume="false"
      @cancel="$emit('cancel')"
      @retry="$emit('retry')"
      @unload-models="$emit('unload-models')"
      @resume="() => {}"
    />
    
    <div class="input-controls-row">
      <AiContextSelector
        :selected-context="selectedContext"
        :current-project="currentProject"
        @context-selected="$emit('context-selected', $event)"
        @remove-context="$emit('remove-context', $event)"
      />
      <AiModeSelector
        placement="top"
        :active-mode-slug="activeModeSlug"
        :modes="modes"
        @change-mode="$emit('change-mode', $event)"
      />
      <AiAutoApproveModal
        placement="top"
        :current-project="currentProject"
        :active-mode-slug="activeModeSlug"
      />
      <!-- 🌐 Переключатель Web Search (DeepSeek Style) -->
      <button
        type="button"
        class="ds-toggle-button interactive-el"
        :class="{ 'is-active': isWebSearchEnabled }"
        :title="isWebSearchEnabled ? 'Поиск в интернете включен' : 'Включить веб-поиск'"
        @click="$emit('toggle-web-search')"
      >
        <div class="ds-toggle-button__icon">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
            <circle cx="8" cy="8" r="6.85" stroke="currentColor" stroke-width="1.3"/>
            <path d="M8 1.15C9.6 1.15 10.9 4.22 10.9 8C10.9 11.78 9.6 14.85 8 14.85" stroke="currentColor" stroke-width="1.3"/>
            <path d="M8 1.15C6.4 1.15 5.1 4.22 5.1 8C5.1 11.78 6.4 14.85 8 14.85" stroke="currentColor" stroke-width="1.3"/>
            <path d="M1.64 8H14.36" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="ds-toggle-label">Search</span>
      </button>
    </div>

    <!-- Баннер цитируемого фрагмента сообщения -->
    <AiQuoteReplyBanner
      :quoted-text="activeQuote?.selected_text"
      @clear="$emit('clear-quote')"
    />

    <AiChatInput 
      ref="chatInputRef"
      :loading="isGenerating"
      :skills="skills"
      @submit="$emit('submit', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import AiActionButtons from '../../controls/AiActionButtons/AiActionButtons.vue';
import AiContextSelector from '../../controls/AiContextSelector/AiContextSelector.vue';
import AiModeSelector from '../../controls/AiModeSelector/AiModeSelector.vue';
import AiAutoApproveModal from '../../tools/AiAutoApproveModal/AiAutoApproveModal.vue';
import AiQuoteReplyBanner from '../AiQuoteReplyBanner/AiQuoteReplyBanner.vue';
import AiChatInput from '../AiChatInput/AiChatInput.vue';
import type { AiChatInputAreaProps, AiChatInputAreaEmits } from './AiChatInputArea.model';
import { useAiChatInputArea } from './useAiChatInputArea';

defineProps<AiChatInputAreaProps>();
defineEmits<AiChatInputAreaEmits>();

const { chatInputRef, unlock, focus } = useAiChatInputArea();

defineExpose({
  unlock,
  focus
});
</script>

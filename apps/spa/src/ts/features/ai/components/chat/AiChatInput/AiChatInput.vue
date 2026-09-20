<template>
  <div class="ai-chat-input-wrapper" :class="{ 'is-focused': isFocused, 'is-loading': loading }">
    <AiSkillAutocomplete
      ref="autocompleteRef"
      :is-open="isSkillAutocompleteOpen"
      :search-query="skillSearchQuery"
      :skills="skills || []"
      @select="handleSelectSkill"
      @close="isSkillAutocompleteOpen = false"
    />

    <editor-content :editor="editor" class="ai-editor" />
    
    <div class="input-actions">
      <div class="input-hints">
        <span class="hint">Enter ⏎ Отправить</span>
        <span class="hint">Shift+Enter ⏎ Новая строка</span>
        <span class="hint">!" Навыки</span>
      </div>
      
      <button
        v-if="loading"
        class="btn-send btn-cancel" 
        title="Отменить генерацию"
        @click="$emit('cancel')"
      >
        <i class="fas fa-stop-circle"></i>
      </button>
      <button
        v-else
        class="btn-send" 
        :disabled="isEmpty" 
        title="Отправить запрос"
        @click="submitMessage"
      >
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EditorContent } from '@tiptap/vue-3';
import AiSkillAutocomplete from './AiSkillAutocomplete.vue';
import type { AiChatInputProps, AiChatInputEmits } from './AiChatInput.model';
import { useAiChatInput } from './useAiChatInput';

const props = defineProps<AiChatInputProps>();
const emit = defineEmits<AiChatInputEmits>();

const {
  editor,
  isFocused,
  isEmpty,
  isSkillAutocompleteOpen,
  skillSearchQuery,
  autocompleteRef,
  handleSelectSkill,
  submitMessage,
  unlock,
  focus
} = useAiChatInput(props, emit);

defineExpose({ unlock, focus });
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiChatInput.css"></style>

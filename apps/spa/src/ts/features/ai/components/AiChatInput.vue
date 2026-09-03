<template>
  <div class="ai-chat-input-wrapper" :class="{ 'is-focused': isFocused, 'is-loading': loading }">
    <editor-content :editor="editor" class="ai-editor" />
    
    <div class="input-actions">
      <div class="input-hints">
        <span class="hint">Enter ⏎ Отправить</span>
        <span class="hint">Shift+Enter ⏎ Новая строка</span>
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
import { 
  useAiChatInput, 
  type AiChatInputProps, 
  type AiChatInputEmits 
} from './useAiChatInput';

const props = defineProps<AiChatInputProps>();
const emit = defineEmits<AiChatInputEmits>();

const {
  editor,
  isFocused,
  isEmpty,
  submitMessage,
  unlock
} = useAiChatInput(props, emit);

defineExpose({ unlock });
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiChatInput.css"></style>

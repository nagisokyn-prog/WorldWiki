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
import { ref, onBeforeUnmount } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';

const props = defineProps<{
  loading?: boolean;
}>();

const emit = defineEmits(['submit', 'cancel']);

const isFocused = ref(false);
const isEmpty = ref(true);

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
      blockquote: false
    })
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-sm focus:outline-none ai-editor-content',
      placeholder: 'Задайте вопрос ИИ...'
    },
    handleKeyDown: (_view, event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submitMessage();
        return true;
      }
      return false;
    }
  },
  onUpdate: ({ editor }) => {
    isEmpty.value = editor.isEmpty;
  },
  onFocus: () => {
    isFocused.value = true;
  },
  onBlur: () => {
    isFocused.value = false;
  }
});

// Promise-based lock — не позволяет отправить второй запрос пока первый не завершился
let sendLock: Promise<void> | null = null;

const submitMessage = () => {
  if (props.loading || !editor.value) return;
  if (sendLock) return; // уже идёт отправка
  
  const text = editor.value.getText().trim();
  if (!text) return;
  
  // Захватываем блокировку сразу, синхронно, до любого await
  let resolveLock!: () => void;
  sendLock = new Promise(res => { resolveLock = res; });
  
  emit('submit', text);
  editor.value.commands.clearContent();
  isEmpty.value = true;
  
  // Снимаем блокировку через 1 секунду на случай если emit не вернёт управление
  setTimeout(() => {
    sendLock = null;
    resolveLock();
  }, 1000);
};

// Позволяет родительскому компоненту снять блокировку после обработки
const unlock = () => {
  sendLock = null;
};

defineExpose({ unlock });

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
  }
});
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiChatInput.css"></style>

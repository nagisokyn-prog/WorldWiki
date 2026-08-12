<template>
  <div class="ai-chat-input-wrapper" :class="{ 'is-focused': isFocused, 'is-loading': loading }">
    <editor-content :editor="editor" class="ai-editor" />
    
    <div class="input-actions">
      <div class="input-hints">
        <span class="hint">Enter ⏎ Отправить</span>
        <span class="hint">Shift+Enter ⏎ Новая строка</span>
      </div>
      
      <button 
        class="btn-send" 
        :disabled="loading || isEmpty" 
        @click="submitMessage"
        title="Отправить запрос"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin"></i>
        <i v-else class="fas fa-paper-plane"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, watch } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';

const props = defineProps<{
  loading?: boolean;
}>();

const emit = defineEmits(['submit']);

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
    handleKeyDown: (view, event) => {
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

watch(() => props.loading, (isLoading) => {
  if (editor.value) {
    editor.value.setEditable(!isLoading);
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

<style scoped>
.ai-chat-input-wrapper {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s, box-shadow 0.2s;
  position: relative;
}

.ai-chat-input-wrapper.is-focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.ai-chat-input-wrapper.is-loading {
  opacity: 0.7;
}

.ai-editor {
  min-height: 40px;
  max-height: 150px;
  overflow-y: auto;
  padding: 4px;
}

/* Tiptap content styling */
:deep(.ai-editor-content p) {
  margin: 0;
  line-height: 1.5;
  color: var(--text-main);
}
:deep(.ai-editor-content p.is-editor-empty:first-child::before) {
  content: attr(placeholder);
  float: left;
  color: var(--text-muted);
  pointer-events: none;
  height: 0;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-color);
}

.input-hints {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-muted);
}

.hint {
  opacity: 0.7;
}

.btn-send {
  background: var(--accent);
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-send:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.btn-send:disabled {
  background: var(--border-color);
  color: var(--text-muted);
  cursor: not-allowed;
}
</style>

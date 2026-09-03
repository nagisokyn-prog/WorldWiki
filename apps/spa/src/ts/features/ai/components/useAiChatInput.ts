import { ref, onBeforeUnmount } from 'vue';
import { useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';

export interface AiChatInputProps {
  loading?: boolean;
}

export interface AiChatInputEmits {
  (e: 'submit', text: string): void;
  (e: 'cancel'): void;
}

export function useAiChatInput(
  props: AiChatInputProps,
  emit: AiChatInputEmits
) {
  const isFocused = ref(false);
  const isEmpty = ref(true);

  let sendLock: Promise<void> | null = null;

  const submitMessage = () => {
    if (props.loading || !editor.value) return;
    if (sendLock) return;
    
    const text = editor.value.getText().trim();
    if (!text) return;
    
    let resolveLock!: () => void;
    sendLock = new Promise(res => { resolveLock = res; });
    
    emit('submit', text);
    editor.value.commands.clearContent();
    isEmpty.value = true;
    
    setTimeout(() => {
      sendLock = null;
      resolveLock();
    }, 1000);
  };

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

  const unlock = () => {
    sendLock = null;
  };

  onBeforeUnmount(() => {
    if (editor.value) {
      editor.value.destroy();
    }
  });

  return {
    editor,
    isFocused,
    isEmpty,
    submitMessage,
    unlock
  };
}

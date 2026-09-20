import { ref, onBeforeUnmount } from 'vue';
import { useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import type { AiSkillItem } from './AiSkillAutocomplete.model';
import type { AiChatInputProps, AiChatInputEmits } from './AiChatInput.model';

export { type AiChatInputProps, type AiChatInputEmits };

export function useAiChatInput(
  props: AiChatInputProps,
  emit: AiChatInputEmits
) {
  const isFocused = ref(false);
  const isEmpty = ref(true);
  const isSkillAutocompleteOpen = ref(false);
  const skillSearchQuery = ref('');
  const skillReplaceRange = ref<{ from: number; to: number } | null>(null);
  const autocompleteRef = ref<{
    selectCurrent: () => void;
    moveNext: () => void;
    movePrev: () => void;
  } | null>(null);

  let sendLock: Promise<void> | null = null;

  const checkSkillTrigger = () => {
    if (!editor.value) return;
    const { selection } = editor.value.state;
    const { from, $from } = selection;
    
    // Получаем текст перед курсором в текущем параграфе
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0');
    const match = textBefore.match(/(?:^|\s)!"([^"\n]*)$/);

    if (match) {
      isSkillAutocompleteOpen.value = true;
      skillSearchQuery.value = match[1];
      const matchIndexInText = textBefore.lastIndexOf('!"');
      const startPos = $from.start() + matchIndexInText;
      skillReplaceRange.value = { from: startPos, to: from };
    } else {
      isSkillAutocompleteOpen.value = false;
      skillSearchQuery.value = '';
      skillReplaceRange.value = null;
    }
  };

  const handleSelectSkill = (skill: AiSkillItem) => {
    if (!editor.value) return;
    const insertText = `!"${skill.name}" `;
    if (skillReplaceRange.value) {
      editor.value
        .chain()
        .focus()
        .deleteRange(skillReplaceRange.value)
        .insertContent(insertText)
        .run();
    } else {
      editor.value
        .chain()
        .focus()
        .insertContent(insertText)
        .run();
    }
    isSkillAutocompleteOpen.value = false;
    skillSearchQuery.value = '';
    skillReplaceRange.value = null;
  };

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
    isSkillAutocompleteOpen.value = false;
    
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
        placeholder: 'Задайте вопрос ИИ (введите !" для выбора навыка)...'
      },
      handleKeyDown: (_view, event) => {
        if (isSkillAutocompleteOpen.value) {
          if (event.key === 'Escape') {
            isSkillAutocompleteOpen.value = false;
            return true;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            autocompleteRef.value?.moveNext();
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            autocompleteRef.value?.movePrev();
            return true;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            autocompleteRef.value?.selectCurrent();
            return true;
          }
        }

        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          submitMessage();
          return true;
        }
        return false;
      }
    },
    onUpdate: ({ editor: ed }) => {
      isEmpty.value = ed.isEmpty;
      checkSkillTrigger();
    },
    onSelectionUpdate: () => {
      checkSkillTrigger();
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

  const focus = () => {
    editor.value?.commands.focus();
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
    isSkillAutocompleteOpen,
    skillSearchQuery,
    autocompleteRef,
    handleSelectSkill,
    submitMessage,
    unlock,
    focus
  };
}

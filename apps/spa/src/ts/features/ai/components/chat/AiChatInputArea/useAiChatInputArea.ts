import { ref } from 'vue';

export function useAiChatInputArea() {
  const chatInputRef = ref<{ unlock: () => void; focus: () => void } | null>(null);

  const unlock = () => chatInputRef.value?.unlock();
  const focus = () => chatInputRef.value?.focus();

  return {
    chatInputRef,
    unlock,
    focus
  };
}


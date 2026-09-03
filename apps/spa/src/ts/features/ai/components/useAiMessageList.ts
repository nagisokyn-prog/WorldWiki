import { ref } from 'vue';

export function useAiMessageList() {
  const containerRef = ref<HTMLElement | null>(null);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error('Ошибка копирования:', e);
    }
  };

  return {
    containerRef,
    copyText
  };
}

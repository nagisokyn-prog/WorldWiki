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

  const isErrorMessage = (content?: string): boolean => {
    if (!content) return false;
    const trimmed = content.trim();
    return (
      trimmed.startsWith('🚫') ||
      trimmed.startsWith('⚠️') ||
      trimmed.startsWith('🔑') ||
      trimmed.startsWith('💳') ||
      trimmed.startsWith('🔍') ||
      trimmed.startsWith('🌐')
    );
  };

  return {
    containerRef,
    copyText,
    isErrorMessage
  };
}

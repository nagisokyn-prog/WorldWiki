import { ref } from 'vue';
import type { ContextItem } from '../components';
import type { ResearchProgress } from '@/features/ai/types/aiPanel.model';

export function useAiContextSelection(options?: {
  onFocusInput?: () => void;
  onCloseToolInspector?: () => void;
}) {
  const selectedContext = ref<ContextItem[]>([]);
  const activeQuote = ref<{ selected_text: string; source_message_id?: string } | null>(null);
  const isWebSearchEnabled = ref<boolean>(
    localStorage.getItem('wowilon_web_search_enabled') === 'true'
  );

  const researchProgress = ref<ResearchProgress>({ stage: 'idle' });

  const toggleWebSearch = () => {
    isWebSearchEnabled.value = !isWebSearchEnabled.value;
    localStorage.setItem('wowilon_web_search_enabled', String(isWebSearchEnabled.value));
  };

  const handleAskWoWiLon = (payload: { selected_text: string; source_message_id?: string }) => {
    activeQuote.value = payload;
    options?.onFocusInput?.();
  };

  const handleClearQuote = () => {
    activeQuote.value = null;
  };

  const handleAskSource = (citation: { domain: string; title: string; excerpt: string; url: string }) => {
    activeQuote.value = {
      selected_text: `Источник: ${citation.title} (${citation.domain})\n${citation.excerpt}`,
    };
    options?.onFocusInput?.();
  };

  const handleAddToLore = (text: string) => {
    selectedContext.value = [
      ...selectedContext.value,
      {
        id: `lore_selection_${Date.now()}`,
        title: 'Выделенный фрагмент',
        type: 'manual',
        content: text,
      },
    ];
  };

  const handleContextSelected = (contexts: ContextItem[]) => {
    selectedContext.value = [...selectedContext.value, ...contexts];
  };

  const handleInsertContext = (text: string) => {
    const newItem: ContextItem = {
      id: `manual_tool_${Date.now()}`,
      title: 'Ручной вызов инструмента',
      type: 'manual',
      content: text
    };
    selectedContext.value = [...selectedContext.value, newItem];
    options?.onCloseToolInspector?.();
  };

  const removeContext = (ctx: ContextItem) => {
    selectedContext.value = selectedContext.value.filter((c: ContextItem) => c.id !== ctx.id);
  };

  return {
    selectedContext,
    activeQuote,
    isWebSearchEnabled,
    researchProgress,
    toggleWebSearch,
    handleAskWoWiLon,
    handleClearQuote,
    handleAskSource,
    handleAddToLore,
    handleContextSelected,
    handleInsertContext,
    removeContext
  };
}

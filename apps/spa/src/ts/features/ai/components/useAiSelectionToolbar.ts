import { ref, onMounted, onUnmounted } from 'vue';
import type { SelectionToolbarPosition, QuotedContextPayload } from './AiSelectionToolbar.model';

export function useAiSelectionToolbar(emit: {
  (e: 'ask-wowilon', payload: QuotedContextPayload): void;
  (e: 'add-to-lore', text: string): void;
}) {
  const position = ref<SelectionToolbarPosition>({
    x: 0,
    y: 0,
    visible: false,
  });

  const selectedText = ref('');
  const sourceMessageId = ref<string | undefined>();

  const handleSelectionChange = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      position.value.visible = false;
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 3) {
      position.value.visible = false;
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Находим родительское сообщение, если есть
    let node: Node | null = range.commonAncestorContainer;
    let msgEl: HTMLElement | null = null;
    while (node && node !== document.body) {
      if (node instanceof HTMLElement && node.dataset.messageId) {
        msgEl = node;
        break;
      }
      node = node.parentNode;
    }

    selectedText.value = text;
    sourceMessageId.value = msgEl ? msgEl.dataset.messageId : undefined;

    position.value = {
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      visible: true,
    };
  };

  const onAskWoWiLon = () => {
    emit('ask-wowilon', {
      selected_text: selectedText.value,
      source_message_id: sourceMessageId.value,
    });
    position.value.visible = false;
  };

  const onAddToLore = () => {
    emit('add-to-lore', selectedText.value);
    position.value.visible = false;
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedText.value);
    } catch {
      // ignore
    }
    position.value.visible = false;
  };

  onMounted(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
  });

  onUnmounted(() => {
    document.removeEventListener('selectionchange', handleSelectionChange);
  });

  return {
    position,
    selectedText,
    onAskWoWiLon,
    onAddToLore,
    onCopy,
  };
}

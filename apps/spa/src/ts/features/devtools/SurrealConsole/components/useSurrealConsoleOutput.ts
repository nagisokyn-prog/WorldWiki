import { ref, onUnmounted } from 'vue';
import type { QueryHistoryItem } from '../SurrealConsole.model';

export interface SurrealConsoleOutputProps {
  output: string;
  result: QueryHistoryItem | null;
  loading: boolean;
}

export function useSurrealConsoleOutput(props: SurrealConsoleOutputProps) {
  const copied = ref(false);
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  const copyToClipboard = async () => {
    if (!props.output) return;
    try {
      await navigator.clipboard.writeText(props.output);
      copied.value = true;
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        copied.value = false;
      }, 2000);
    } catch (err) {
      console.warn('[useSurrealConsoleOutput] Failed to write to clipboard:', err);
    }
  };

  onUnmounted(() => {
    if (copyTimeout) {
      clearTimeout(copyTimeout);
      copyTimeout = null;
    }
  });

  return {
    copied,
    copyToClipboard,
  };
}

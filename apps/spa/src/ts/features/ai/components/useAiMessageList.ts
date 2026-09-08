import { ref } from 'vue';

export interface MessageContentSegment {
  type: 'markdown' | 'mermaid';
  content: string;
}

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

  const parseMessageContent = (content?: string): MessageContentSegment[] => {
    if (!content) return [];
    const segments: MessageContentSegment[] = [];
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mermaidRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const text = content.slice(lastIndex, match.index);
        if (text.trim()) {
          segments.push({ type: 'markdown', content: text });
        }
      }
      const diagramCode = match[1].trim();
      if (diagramCode) {
        segments.push({ type: 'mermaid', content: diagramCode });
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      const text = content.slice(lastIndex);
      if (text.trim()) {
        segments.push({ type: 'markdown', content: text });
      }
    }

    if (segments.length === 0) {
      return [{ type: 'markdown', content }];
    }

    return segments;
  };

  return {
    containerRef,
    copyText,
    isErrorMessage,
    parseMessageContent
  };
}

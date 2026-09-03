import { computed } from 'vue';

export interface TextPart {
  text: string;
  isMatch: boolean;
}

export interface HighlightTextProps {
  text: string;
  query?: string;
}

export function useHighlightText(props: HighlightTextProps) {
  const parts = computed<TextPart[]>(() => {
    if (!props.text) return [];
    const q = (props.query || '').trim();
    if (!q) {
      return [{ text: props.text, isMatch: false }];
    }

    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const rawParts = props.text.split(regex);

    return rawParts.filter(Boolean).map(segment => ({
      text: segment,
      isMatch: segment.toLowerCase() === q.toLowerCase()
    }));
  });

  return {
    parts
  };
}

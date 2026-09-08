export interface SelectionToolbarPosition {
  x: number;
  y: number;
  visible: boolean;
}

export interface QuotedContextPayload {
  source_chat_id?: string;
  source_message_id?: string;
  selected_text: string;
  range?: [number, number];
}

export interface AiSelectionToolbarProps {
  containerRef?: HTMLElement | null;
}

export interface AiSelectionToolbarEmits {
  (e: 'ask-wowilon', payload: QuotedContextPayload): void;
  (e: 'add-to-lore', text: string): void;
}

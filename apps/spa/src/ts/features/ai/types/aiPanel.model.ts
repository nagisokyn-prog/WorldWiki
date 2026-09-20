import type { ToolCallPayload } from '../components';

export interface ChatMessageCitation {
  index: number;
  evidence_id: string;
  page_id?: string;
  url: string;
  domain: string;
  title: string;
  claim_text?: string;
  excerpt: string;
}

export interface ChatMessageQuotedContext {
  selected_text?: string;
  source_message_id?: string;
  source_chat_id?: string;
  range?: [number, number];
  author?: string;
  name?: string;
  content?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  toolLogs?: string[];
  toolCallWaiting?: ToolCallPayload | null;
  quoted_context?: ChatMessageQuotedContext | null;
  citations?: ChatMessageCitation[] | null;
  parent_id?: string | null;
  is_active?: boolean;
  is_error?: boolean;
}

export interface MessageVariantGroup {
  variants: ChatMessage[];
  activeIndex: number;
  activeMessage: ChatMessage;
}

export interface ResearchProgress {
  stage: 'planning' | 'searching' | 'reading' | 'synthesizing' | 'completed' | 'idle';
  query?: string;
  hitsCount?: number;
  pagesCount?: number;
  evidenceCount?: number;
}

export interface WowilonPanelProps {
  isOpen: boolean;
}

export interface WowilonPanelEmits {
  (e: 'close'): void;
}

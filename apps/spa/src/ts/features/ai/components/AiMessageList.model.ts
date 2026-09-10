import type { ChatMessage, MessageVariantGroup } from '../useWowilonPanel';
import type { ToolCallPayload } from './AiToolApproval.vue';
import type { CitationItem } from './AiCitation.model';

export interface AttachedSkill {
  name: string;
  content: string;
}

export interface ExtractedQuote {
  text: string;
  author?: string;
}

export interface MessageSegment {
  type: 'markdown' | 'mermaid';
  content: string;
}

export interface AiMessageListProps {
  messages: ChatMessage[];
  renderedMessages: MessageVariantGroup[];
  activeChatId: string;
  chatTitle: string;
  editingMessageId: string | null;
  editDraft: string;
  renderMarkdown: (text: string) => string;
  isGenerating?: boolean;
}

export interface AiMessageListEmits {
  (e: 'scroll', event: Event): void;
  (e: 'update:editDraft', val: string): void;
  (e: 'switch-variant', msgId: string): void;
  (e: 'start-edit', message: ChatMessage): void;
  (e: 'cancel-edit'): void;
  (e: 'save-edit', messageId: string): void;
  (e: 'regenerate', parentId: string): void;
  (e: 'branch', messageId: string | undefined): void;
  (e: 'delete', messageId: string): void;
  (e: 'tool-approve', payload: ToolCallPayload): void;
  (e: 'tool-reject', payload: ToolCallPayload): void;
  (e: 'ask-source', citation: CitationItem): void;
}

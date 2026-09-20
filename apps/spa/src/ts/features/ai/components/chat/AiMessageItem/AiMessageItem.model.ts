import type { MessageVariantGroup, ChatMessage } from '../../../types/aiPanel.model';
import type { ToolCallPayload } from '../../tools/AiToolApproval/useAiToolApproval';
import type { CitationItem } from '../../citations/AiCitation.model';

export interface AiMessageItemProps {
  group: MessageVariantGroup;
  idx: number;
  editingMessageId: string | null;
  editDraft: string;
  renderMarkdown: (text: string) => string;
  isGenerating?: boolean;
}

export interface AiMessageItemEmits {
  (e: 'update:editDraft', text: string): void;
  (e: 'switch-variant', id: string): void;
  (e: 'start-edit', msg: ChatMessage): void;
  (e: 'cancel-edit'): void;
  (e: 'save-edit', id: string): void;
  (e: 'regenerate', parentId: string): void;
  (e: 'branch', id?: string): void;
  (e: 'delete', id: string): void;
  (e: 'tool-approve', payload: { toolCallId: string; approved: boolean }): void;
  (e: 'tool-reject', payload: { toolCallId: string; approved: boolean; feedback: string }): void;
  (e: 'ask-source', citation: CitationItem): void;
}

import type { ContextItem, AiTopBarMode } from '../../../components';
import type { AiSkillItem } from '../../../skills/aiSkills.model';

export interface AiChatInputAreaProps {
  isGenerating?: boolean;
  hasError?: boolean;
  selectedContext: ContextItem[];
  currentProject: string;
  activeModeSlug: string;
  modes: AiTopBarMode[];
  isWebSearchEnabled: boolean;
  activeQuote: { selected_text: string; source_message_id?: string } | null;
  skills: AiSkillItem[];
}

export interface AiChatInputAreaEmits {
  (e: 'cancel'): void;
  (e: 'retry'): void;
  (e: 'unload-models'): void;
  (e: 'context-selected', contexts: ContextItem[]): void;
  (e: 'remove-context', context: ContextItem): void;
  (e: 'change-mode', mode: string): void;
  (e: 'toggle-web-search'): void;
  (e: 'clear-quote'): void;
  (e: 'submit', text: string): void;
}

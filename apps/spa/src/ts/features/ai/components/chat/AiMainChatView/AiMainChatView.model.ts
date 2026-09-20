import type { UseWowilonPanelReturn } from '../../../useWowilonPanel';

export interface AiMainChatViewProps {
  panel: UseWowilonPanelReturn;
}

export interface AiMainChatViewEmits {
  (e: 'open-settings'): void;
}

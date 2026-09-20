export interface AiActionButtonsProps {
  isGenerating?: boolean;
  hasError?: boolean;
  canResume?: boolean;
}

export type AiActionButtonsEmits = {
  (e: 'cancel'): void;
  (e: 'unload-models'): void;
  (e: 'retry'): void;
  (e: 'resume'): void;
};

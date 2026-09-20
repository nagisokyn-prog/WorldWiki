export interface AiHeaderProps {
  isDetached?: boolean;
}

export type AiHeaderEmits = {
  (e: 'close'): void;
  (e: 'detach'): void;
  (e: 'open-settings'): void;
};

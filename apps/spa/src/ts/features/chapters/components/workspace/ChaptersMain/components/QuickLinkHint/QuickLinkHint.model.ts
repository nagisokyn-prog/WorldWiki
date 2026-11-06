export interface QuickLinkHintProps {
  isOpen: boolean;
    hideForever: boolean;
}

export type QuickLinkHintEmits = {
  (e: 'close'): void;
    (e: 'open'): void;
    (e: 'dismissForever'): void;
};

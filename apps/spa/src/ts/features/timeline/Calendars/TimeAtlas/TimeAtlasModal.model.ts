export interface TimeAtlasModalProps {
  project: string;
    isOpen: boolean;
}

export type TimeAtlasModalEmits = {
  (e: 'close'): void;
};

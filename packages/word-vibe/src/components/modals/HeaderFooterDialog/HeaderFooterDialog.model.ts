export interface HeaderFooterContent {
  left: string;
  center: string;
  right: string;
}

export interface HeaderFooterDialogProps {
  isOpen: boolean;
  initialTab?: 'header' | 'footer';
  header?: HeaderFooterContent;
  footer?: HeaderFooterContent;
}

export type HeaderFooterDialogEmits = {
  (e: 'close'): void;
  (e: 'apply', payload: { header: HeaderFooterContent; footer: HeaderFooterContent }): void;
};


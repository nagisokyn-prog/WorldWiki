import type { PaperSize, RibbonCommands } from '../../ribbon/commands';

export interface WordRibbonBarProps {
  commands: RibbonCommands;
  isInsideTable?: boolean;
}

export type WordRibbonBarEmits = {
  (e: 'open-paragraph-dialog'): void;
  (e: 'open-font-dialog'): void;
  (e: 'open-page-setup'): void;
  (e: 'open-header-footer-dialog', tab?: 'header' | 'footer'): void;
};

export type { PaperSize, RibbonCommands };


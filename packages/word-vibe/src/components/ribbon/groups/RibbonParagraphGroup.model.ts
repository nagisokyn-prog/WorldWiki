import type { RibbonCommands } from '../../../ribbon/commands';

export interface RibbonParagraphGroupProps {
  currentLineHeight: string;
  showInvisibles: boolean;
  commands: Partial<RibbonCommands>;
  call: (name: string, fn?: () => void) => void;
}

export type RibbonParagraphGroupEmits = {
  (e: 'update:lineHeight', val: string): void;
  (e: 'toggleInvisibles'): void;
  (e: 'open-paragraph-dialog'): void;
};


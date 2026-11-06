import type { SchemaSection } from '../EntityEditor.model';

export interface EntityHiddenManagerProps {
  isOpen: boolean;
  totalHiddenCount: number;
  hiddenSections: string[];
  hiddenFields: string[];
  hiddenContainers: string[];
  sections?: SchemaSection[];
  getFieldLabel: (key: string) => string;
  getContainerTitle: (key: string) => string;
}

export type EntityHiddenManagerEmits = {
  (e: 'toggleOpen'): void;
  (e: 'close'): void;
  (e: 'unhideAll'): void;
  (e: 'unhideSection', id: string): void;
  (e: 'unhideField', key: string): void;
  (e: 'unhideContainer', id: string): void;
};


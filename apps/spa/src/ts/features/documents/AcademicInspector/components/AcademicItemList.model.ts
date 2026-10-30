import type { InspectorItem } from '../AcademicInspector.model';

export interface AcademicItemListProps {
  sectionTitle: string;
  emptyMessage: string;
  items: InspectorItem[];
  formatNumber?: (num?: string | number) => string;
}

export type AcademicItemListEmits = {
  (e: 'jump', id: string): void;
  (e: 'insert', item: InspectorItem): void;
};

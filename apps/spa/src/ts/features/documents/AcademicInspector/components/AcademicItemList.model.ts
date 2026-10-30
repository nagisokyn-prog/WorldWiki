import type { InspectorItem } from '../AcademicInspector.model'

export interface AcademicItemListProps {}

export type AcademicItemListEmits = {
  (e: 'jump', id: string): void;
    (e: 'insert', item: InspectorItem): void;
};

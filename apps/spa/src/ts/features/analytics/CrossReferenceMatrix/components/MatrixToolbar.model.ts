import type { CrossReferenceFilterState } from '../CrossReferenceMatrix.model';

export interface MatrixToolbarProps {
  filters: CrossReferenceFilterState;
  availableEntityTypes: string[];
  volumeOptions?: Array<{ id: string; title: string }>;
  rowsCount: number;
  chaptersCount: number;
  isLoading: boolean;
}

export type MatrixToolbarEmits = {
  (e: 'refresh'): void;
};


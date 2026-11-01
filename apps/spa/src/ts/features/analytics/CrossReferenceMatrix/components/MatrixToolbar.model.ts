import type { CrossReferenceFilterState } from '../CrossReferenceMatrix.model';

export interface MatrixToolbarProps {
  filters: CrossReferenceFilterState;
  availableEntityTypes: string[];
  rowsCount: number;
  chaptersCount: number;
  isLoading: boolean;
}

export type MatrixToolbarEmits = {
  (e: 'refresh'): void;
};


import type { PageSize } from '../../types/dto';

export interface WordRulerProps {
  pageSize?: PageSize;
  isLandscape?: boolean;
  firstLineIndentCm?: number;
  leftIndentCm?: number;
  rightIndentCm?: number;
}

export type WordRulerEmits = {
  (e: 'update:firstLineIndent', cm: number): void;
  (e: 'update:leftIndent', cm: number): void;
  (e: 'update:rightIndent', cm: number): void;
};


import type { SemanticDocument } from '@/services/document/ast/types'
import type { PlotPromise } from '@/types/generated/PlotPromise'
import type { RichPlotPromise } from '@/features/chapters/PromisesPanel/usePromisesPanel'
import type { PromiseTypeOption } from '../usePromiseContextMenu'
import type { InsertEntityPayload } from '../EntityLinkSelector.model'

export interface EditorModalsProps {
  project: string;
    isEntitySelectorOpen: boolean;
    entitySelectorQuery?: string;
    isPromiseMenuOpen: boolean;
    promiseMenuPos: { x: number; y: number };
    existingPromises?: (PlotPromise | RichPlotPromise)[];
    isExportModalOpen: boolean;
    currentSemanticDocument: SemanticDocument;
    isParagraphModalOpen: boolean;
}

export type EditorModalsEmits = {
  (e: 'close-entity-selector'): void;
    (e: 'insert-entity', entity: InsertEntityPayload): void;
    (e: 'close-promise-menu'): void;
    (e: 'select-promise', option: PromiseTypeOption): void;
    (e: 'link-milestone', payload: { promise: PlotPromise | RichPlotPromise; stage: 'progression' | 'resolution' }): void;
    (e: 'close-export-modal'): void;
    (e: 'close-paragraph-modal'): void;
    (e: 'apply-paragraph-format', format: ParagraphFormatData): void;
};

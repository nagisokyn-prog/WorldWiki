/**
 * @file types.ts
 * @description Типы данных движка worldwiki-ast-diff-wasm.
 * Полностью соответствуют Rust-структурам из worldwiki-document-core.
 */

export interface SemanticBlock {
  id: string;
  block_type: string;
  content: string;
  metadata?: string | null;
}

export interface SemanticDocument {
  version: number;
  blocks: SemanticBlock[];
}

export interface InlineChange {
  position: number;
  delete_count: number;
  insert_text: string;
}

export type DiffOperation =
  | {
      InsertBlock: {
        index: number;
        block: SemanticBlock;
      };
    }
  | {
      DeleteBlock: {
        index: number;
        block_id: string;
      };
    }
  | {
      UpdateBlock: {
        index: number;
        block_id: string;
        inline_changes: InlineChange[];
        new_block_type?: string;
        new_metadata?: string | null;
      };
    }
  | {
      MoveBlock: {
        from_index: number;
        to_index: number;
        block_id: string;
      };
    };

export interface DocumentDiffResult {
  operations: DiffOperation[];
  word_count_delta: number;
  has_structural_changes: boolean;
}

export type PatchError =
  | { BlockNotFound: { id: string } }
  | { IndexOutOfBounds: { index: number; len: number } }
  | { InlinePositionOutOfBounds: { position: number; len: number } }
  | { MismatchedBlockId: { expected: string; actual: string } };


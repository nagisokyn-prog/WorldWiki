extern crate alloc;

use alloc::vec::Vec;

pub use crate::diff::diff_documents;
use crate::inline_diff::apply_inline_changes;
use crate::model::{
    DiffOperation, DocumentDiffResult, PatchError, SemanticBlock, SemanticDocument,
};

fn validate_move_operations(
    ops: &[DiffOperation],
    old_doc: &SemanticDocument,
) -> Result<(), PatchError> {
    for op in ops {
        if let DiffOperation::MoveBlock {
            from_index,
            block_id,
            ..
        } = op
        {
            let target_blk = old_doc.blocks.get(*from_index).ok_or(PatchError::IndexOutOfBounds {
                index: *from_index,
                len: old_doc.blocks.len(),
            })?;
            if target_blk.id != *block_id {
                return Err(PatchError::MismatchedBlockId {
                    expected: block_id.clone(),
                    actual: target_blk.id.clone(),
                });
            }
        }
    }
    Ok(())
}

fn apply_update_operations(
    blocks: &mut [SemanticBlock],
    ops: &[DiffOperation],
) -> Result<(), PatchError> {
    for op in ops {
        if let DiffOperation::UpdateBlock {
            block_id,
            inline_changes,
            new_block_type,
            new_metadata,
            ..
        } = op
        {
            let block = blocks
                .iter_mut()
                .find(|b| &b.id == block_id)
                .ok_or_else(|| PatchError::BlockNotFound {
                    id: block_id.clone(),
                })?;

            if let Some(bt) = new_block_type {
                block.block_type = bt.clone();
            }
            if let Some(md) = new_metadata {
                block.metadata = md.clone();
            }

            let updated_text =
                apply_inline_changes(&block.content, inline_changes).map_err(|_| {
                    PatchError::InlinePositionOutOfBounds {
                        position: 0,
                        len: block.content.chars().count(),
                    }
                })?;

            block.content = updated_text;
        }
    }
    Ok(())
}

fn apply_delete_operations(
    blocks: &mut Vec<SemanticBlock>,
    ops: &[DiffOperation],
) -> Result<(), PatchError> {
    for op in ops {
        if let DiffOperation::DeleteBlock { block_id, .. } = op {
            if let Some(pos) = blocks.iter().position(|b| &b.id == block_id) {
                blocks.remove(pos);
            } else {
                return Err(PatchError::BlockNotFound {
                    id: block_id.clone(),
                });
            }
        }
    }
    Ok(())
}

fn apply_move_operations(
    blocks: &mut Vec<SemanticBlock>,
    ops: &[DiffOperation],
) -> Result<(), PatchError> {
    for op in ops {
        if let DiffOperation::MoveBlock {
            to_index,
            block_id,
            ..
        } = op
        {
            let current_pos = blocks
                .iter()
                .position(|b| &b.id == block_id)
                .ok_or_else(|| PatchError::BlockNotFound {
                    id: block_id.clone(),
                })?;

            let block = blocks.remove(current_pos);
            let target_idx = (*to_index).min(blocks.len());
            blocks.insert(target_idx, block);
        }
    }
    Ok(())
}

fn apply_insert_operations(blocks: &mut Vec<SemanticBlock>, ops: &[DiffOperation]) {
    let mut inserts: Vec<(usize, &SemanticBlock)> = Vec::with_capacity(ops.len() + 4);
    for op in ops {
        if let DiffOperation::InsertBlock { index, block } = op {
            inserts.push((*index, block));
        }
    }

    inserts.sort_by_key(|&(idx, _)| idx);

    for (idx, block) in inserts {
        let insert_idx = idx.min(blocks.len());
        blocks.insert(insert_idx, block.clone());
    }
}

/// Applies a `DocumentDiffResult` patch to an existing `SemanticDocument`.
pub fn apply_patch(
    old_doc: &SemanticDocument,
    diff: &DocumentDiffResult,
) -> Result<SemanticDocument, PatchError> {
    let mut blocks = Vec::with_capacity(old_doc.blocks.len() + diff.operations.len() + 8);
    blocks.extend_from_slice(&old_doc.blocks);

    validate_move_operations(&diff.operations, old_doc)?;
    apply_update_operations(&mut blocks, &diff.operations)?;
    apply_delete_operations(&mut blocks, &diff.operations)?;
    apply_move_operations(&mut blocks, &diff.operations)?;
    apply_insert_operations(&mut blocks, &diff.operations);

    Ok(SemanticDocument {
        version: old_doc.version + 1,
        blocks,
    })
}

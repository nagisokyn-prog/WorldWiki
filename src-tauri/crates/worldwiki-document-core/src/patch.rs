extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use hashbrown::HashSet;

use crate::inline_diff::{apply_inline_changes, compute_inline_diff};
use crate::model::{
    DiffOperation, DocumentDiffResult, PatchError, SemanticBlock, SemanticDocument,
};
use crate::myers::{EditOp, myers_diff};

/// Computes the structural and inline diff between two semantic documents.
pub fn diff_documents(
    old_doc: &SemanticDocument,
    new_doc: &SemanticDocument,
) -> DocumentDiffResult {
    let word_count_delta =
        (new_doc.total_word_count() as i64) - (old_doc.total_word_count() as i64);

    if old_doc.blocks == new_doc.blocks {
        return DocumentDiffResult {
            operations: Vec::new(),
            word_count_delta,
            has_structural_changes: false,
        };
    }

    let old_id_map: hashbrown::HashMap<&str, (usize, &SemanticBlock)> = old_doc
        .blocks
        .iter()
        .enumerate()
        .map(|(idx, b)| (b.id.as_str(), (idx, b)))
        .collect();

    let old_ids: Vec<String> = old_doc.blocks.iter().map(|b| b.id.clone()).collect();
    let new_ids: Vec<String> = new_doc.blocks.iter().map(|b| b.id.clone()).collect();

    let ops = myers_diff(&old_ids, &new_ids);

    let mut raw_deletions: Vec<(usize, String)> = Vec::new();
    let mut raw_insertions: Vec<(usize, SemanticBlock)> = Vec::new();
    let mut operations = Vec::new();

    let mut old_idx = 0usize;
    let mut new_idx = 0usize;
    let mut has_structural_changes = false;

    for op in ops {
        match op {
            EditOp::Keep(id) => {
                let old_block = &old_doc.blocks[old_idx];
                let new_block = &new_doc.blocks[new_idx];

                if old_block.content != new_block.content
                    || old_block.block_type != new_block.block_type
                    || old_block.metadata != new_block.metadata
                {
                    let inline_changes =
                        compute_inline_diff(&old_block.content, &new_block.content);
                    operations.push(DiffOperation::UpdateBlock {
                        index: new_idx,
                        block_id: id,
                        inline_changes,
                    });
                }

                old_idx += 1;
                new_idx += 1;
            }
            EditOp::Delete(id) => {
                has_structural_changes = true;
                raw_deletions.push((old_idx, id));
                old_idx += 1;
            }
            EditOp::Insert(_) => {
                has_structural_changes = true;
                let block = &new_doc.blocks[new_idx];
                raw_insertions.push((new_idx, block.clone()));
                new_idx += 1;
            }
        }
    }

    // Correlate deletions and insertions into MoveBlock operations when IDs match
    let mut moved_ids = HashSet::new();

    for (del_idx, del_id) in &raw_deletions {
        if let Some((ins_idx, ins_block)) = raw_insertions.iter().find(|(_, b)| &b.id == del_id) {
            moved_ids.insert(del_id.clone());
            operations.push(DiffOperation::MoveBlock {
                from_index: *del_idx,
                to_index: *ins_idx,
                block_id: del_id.clone(),
            });

            // If the moved block also had content modifications, generate UpdateBlock too
            if let Some((_, old_block)) = old_id_map.get(del_id.as_str())
                && old_block.content != ins_block.content
            {
                let inline_changes = compute_inline_diff(&old_block.content, &ins_block.content);
                operations.push(DiffOperation::UpdateBlock {
                    index: *ins_idx,
                    block_id: del_id.clone(),
                    inline_changes,
                });
            }
        }
    }

    // Remaining deletions
    for (del_idx, del_id) in raw_deletions {
        if !moved_ids.contains(&del_id) {
            operations.push(DiffOperation::DeleteBlock {
                index: del_idx,
                block_id: del_id,
            });
        }
    }

    // Remaining insertions
    for (ins_idx, ins_block) in raw_insertions {
        if !moved_ids.contains(&ins_block.id) {
            operations.push(DiffOperation::InsertBlock {
                index: ins_idx,
                block: ins_block,
            });
        }
    }

    DocumentDiffResult {
        operations,
        word_count_delta,
        has_structural_changes,
    }
}

/// Applies a `DocumentDiffResult` patch to an existing `SemanticDocument`.
pub fn apply_patch(
    old_doc: &SemanticDocument,
    diff: &DocumentDiffResult,
) -> Result<SemanticDocument, PatchError> {
    let mut blocks = old_doc.blocks.clone();

    // 1. Process UpdateBlock
    for op in &diff.operations {
        if let DiffOperation::UpdateBlock {
            block_id,
            inline_changes,
            ..
        } = op
        {
            let block = blocks
                .iter_mut()
                .find(|b| &b.id == block_id)
                .ok_or_else(|| PatchError::BlockNotFound {
                    id: block_id.clone(),
                })?;

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

    // 2. Process DeleteBlock (processed by block_id to be resilient to index shifts)
    for op in &diff.operations {
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

    // 3. Process MoveBlock (with validation)
    for op in &diff.operations {
        if let DiffOperation::MoveBlock {
            from_index,
            to_index,
            block_id,
        } = op
        {
            if *from_index >= blocks.len() {
                return Err(PatchError::IndexOutOfBounds {
                    index: *from_index,
                    len: blocks.len(),
                });
            }

            let current_pos = blocks
                .iter()
                .position(|b| &b.id == block_id)
                .ok_or_else(|| PatchError::BlockNotFound {
                    id: block_id.clone(),
                })?;

            if current_pos != *from_index {
                return Err(PatchError::MismatchedBlockId {
                    expected: block_id.clone(),
                    actual: blocks[*from_index].id.clone(),
                });
            }

            let block = blocks.remove(current_pos);
            let target_idx = (*to_index).min(blocks.len());
            blocks.insert(target_idx, block);
        }
    }

    // 4. Process InsertBlock (ordered by index)
    let mut inserts: Vec<(usize, &SemanticBlock)> = diff
        .operations
        .iter()
        .filter_map(|op| match op {
            DiffOperation::InsertBlock { index, block } => Some((*index, block)),
            _ => None,
        })
        .collect();

    inserts.sort_by_key(|(idx, _)| *idx);

    for (idx, block) in inserts {
        let insert_idx = idx.min(blocks.len());
        blocks.insert(insert_idx, block.clone());
    }

    Ok(SemanticDocument {
        version: old_doc.version + 1,
        blocks,
    })
}

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;

use crate::inline_diff::compute_inline_diff;
use crate::model::{DiffOperation, DocumentDiffResult, SemanticBlock, SemanticDocument};
use crate::myers::{EditOp, myers_diff};

#[inline]
fn build_block_update(
    old_block: &SemanticBlock,
    new_block: &SemanticBlock,
    index: usize,
    block_id: &str,
) -> Option<DiffOperation> {
    if old_block.content != new_block.content
        || old_block.block_type != new_block.block_type
        || old_block.metadata != new_block.metadata
    {
        let inline_changes = compute_inline_diff(&old_block.content, &new_block.content);
        let new_block_type = if old_block.block_type != new_block.block_type {
            Some(new_block.block_type.clone())
        } else {
            None
        };
        let new_metadata = if old_block.metadata != new_block.metadata {
            Some(new_block.metadata.clone())
        } else {
            None
        };

        Some(DiffOperation::UpdateBlock {
            index,
            block_id: String::from(block_id),
            inline_changes,
            new_block_type,
            new_metadata,
        })
    } else {
        None
    }
}

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

    let mut old_ids: Vec<&str> = Vec::with_capacity(old_doc.blocks.len() + 4);
    for b in &old_doc.blocks {
        old_ids.push(b.id.as_str());
    }
    let mut new_ids: Vec<&str> = Vec::with_capacity(new_doc.blocks.len() + 4);
    for b in &new_doc.blocks {
        new_ids.push(b.id.as_str());
    }

    let ops = myers_diff(&old_ids, &new_ids);

    let mut raw_deletions: Vec<(usize, String)> = Vec::with_capacity(ops.len() + 4);
    let mut raw_insertions: Vec<(usize, SemanticBlock)> = Vec::with_capacity(ops.len() + 4);
    let mut operations = Vec::with_capacity(ops.len() * 2 + 4);

    let mut old_idx = 0usize;
    let mut new_idx = 0usize;
    let mut has_structural_changes = false;

    for op in ops {
        match op {
            EditOp::Keep(id) => {
                if let (Some(old_b), Some(new_b)) =
                    (old_doc.blocks.get(old_idx), new_doc.blocks.get(new_idx))
                    && let Some(update_op) = build_block_update(old_b, new_b, new_idx, id)
                {
                    operations.push(update_op);
                }
                old_idx += 1;
                new_idx += 1;
            }
            EditOp::Delete(id) => {
                has_structural_changes = true;
                raw_deletions.push((old_idx, String::from(id)));
                old_idx += 1;
            }
            EditOp::Insert(_) => {
                has_structural_changes = true;
                if let Some(block) = new_doc.blocks.get(new_idx) {
                    raw_insertions.push((new_idx, block.clone()));
                }
                new_idx += 1;
            }
        }
    }

    // Correlate deletions and insertions into MoveBlock operations when IDs match
    let mut moved_ids: Vec<String> = Vec::with_capacity(raw_deletions.len());

    for (del_idx, del_id) in &raw_deletions {
        if let Some((ins_idx, ins_block)) = raw_insertions.iter().find(|(_, b)| &b.id == del_id) {
            moved_ids.push(del_id.clone());
            operations.push(DiffOperation::MoveBlock {
                from_index: *del_idx,
                to_index: *ins_idx,
                block_id: del_id.clone(),
            });

            // If the moved block also had content modifications, generate UpdateBlock too
            if let Some(old_b) = old_doc.blocks.get(*del_idx)
                && let Some(update_op) = build_block_update(old_b, ins_block, *ins_idx, del_id)
            {
                operations.push(update_op);
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


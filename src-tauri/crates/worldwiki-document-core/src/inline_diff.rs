extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use crate::model::InlineChange;
use crate::myers::{myers_diff, EditOp};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InlineApplyError {
    PositionOutOfBounds,
    DeleteCountOutOfBounds,
}

/// Computes character-level inline differences between two text strings
/// and compacts them into a sequence of `InlineChange` instructions.
pub fn compute_inline_diff(old_text: &str, new_text: &str) -> Vec<InlineChange> {
    if old_text == new_text {
        return Vec::new();
    }

    let mut old_chars = Vec::with_capacity(old_text.len() + 16);
    old_chars.extend(old_text.chars());
    let mut new_chars = Vec::with_capacity(new_text.len() + 16);
    new_chars.extend(new_text.chars());

    let ops = myers_diff(&old_chars, &new_chars);

    let mut changes = Vec::with_capacity(ops.len() + 16);
    let mut current_pos = 0usize;

    let mut pending_delete_count = 0usize;
    let mut pending_insert = String::with_capacity(new_text.len().saturating_mul(4) + 16);
    let mut change_start_pos = 0usize;
    let mut in_change = false;

    for op in ops {
        match op {
            EditOp::Keep(_) => {
                if in_change {
                    changes.push(InlineChange {
                        position: change_start_pos,
                        delete_count: pending_delete_count,
                        insert_text: pending_insert.clone(),
                    });
                    pending_delete_count = 0;
                    pending_insert.clear();
                    in_change = false;
                }
                current_pos += 1;
            }
            EditOp::Delete(_) => {
                if !in_change {
                    in_change = true;
                    change_start_pos = current_pos;
                }
                pending_delete_count += 1;
                // Deleting consumes a character from old_text coordinates
                current_pos += 1;
            }
            EditOp::Insert(c) => {
                if !in_change {
                    in_change = true;
                    change_start_pos = current_pos;
                }
                pending_insert.push(c);
                // Inserting does not advance old_text coordinates
            }
        }
    }

    if in_change {
        changes.push(InlineChange {
            position: change_start_pos,
            delete_count: pending_delete_count,
            insert_text: pending_insert,
        });
    }

    changes
}

/// Applies inline changes to a base string.
pub fn apply_inline_changes(base: &str, changes: &[InlineChange]) -> Result<String, InlineApplyError> {
    let mut extra_bytes = 0usize;
    for c in changes {
        extra_bytes = extra_bytes.saturating_add(c.insert_text.len());
    }

    let mut chars: Vec<char> = Vec::with_capacity(base.len() + 16);
    chars.extend(base.chars());

    // Sort changes ascending by position
    let mut sorted_changes = Vec::with_capacity(changes.len() + 4);
    sorted_changes.extend_from_slice(changes);
    sorted_changes.sort_by_key(|c| c.position);

    let mut out = String::with_capacity(base.len().saturating_add(extra_bytes).saturating_add(16));
    let mut cursor = 0usize;

    for change in sorted_changes {
        if change.position > chars.len() {
            return Err(InlineApplyError::PositionOutOfBounds);
        }
        let end = change
            .position
            .checked_add(change.delete_count)
            .ok_or(InlineApplyError::DeleteCountOutOfBounds)?;
        if end > chars.len() || change.position < cursor {
            return Err(InlineApplyError::DeleteCountOutOfBounds);
        }

        if let Some(slice) = chars.get(cursor..change.position) {
            for &ch in slice {
                out.push(ch);
            }
        }
        out.push_str(&change.insert_text);
        cursor = end;
    }

    if let Some(tail) = chars.get(cursor..) {
        for &ch in tail {
            out.push(ch);
        }
    }

    Ok(out)
}

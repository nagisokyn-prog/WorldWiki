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

    let old_chars: Vec<char> = old_text.chars().collect();
    let new_chars: Vec<char> = new_text.chars().collect();

    let ops = myers_diff(&old_chars, &new_chars);

    let mut changes = Vec::new();
    let mut current_pos = 0usize;

    let mut pending_delete_count = 0usize;
    let mut pending_insert = String::new();
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
    let mut chars: Vec<char> = base.chars().collect();

    // Sort changes descending by position to prevent index shifting
    let mut sorted_changes = changes.to_vec();
    sorted_changes.sort_by_key(|a| core::cmp::Reverse(a.position));

    for change in sorted_changes {
        if change.position > chars.len() {
            return Err(InlineApplyError::PositionOutOfBounds);
        }
        let end = change.position + change.delete_count;
        if end > chars.len() {
            return Err(InlineApplyError::DeleteCountOutOfBounds);
        }

        chars.splice(change.position..end, change.insert_text.chars());
    }

    Ok(chars.into_iter().collect())
}

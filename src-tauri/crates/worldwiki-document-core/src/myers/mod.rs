extern crate alloc;

use alloc::vec::Vec;

pub mod backtrack;
pub mod ops;
pub mod trace;

pub use backtrack::backtrack_edit_script;
pub use ops::EditOp;
pub use trace::find_edit_trace;

/// Classic, robust Myers difference algorithm on two slices of comparable items.
/// Returns the sequence of Keep, Insert, and Delete edit operations.
pub fn myers_diff<T: Clone + PartialEq>(old: &[T], new: &[T]) -> Vec<EditOp<T>> {
    let n = old.len();
    let m = new.len();

    if n == 0 {
        return new.iter().cloned().map(EditOp::Insert).collect();
    }

    if m == 0 {
        return old.iter().cloned().map(EditOp::Delete).collect();
    }

    let max = n + m;
    let offset = max;
    let stride = 2 * max + 1;

    let (trace, found_d) = find_edit_trace(old, new, max, offset, stride);
    backtrack_edit_script(old, new, &trace, found_d, max, offset, stride)
}

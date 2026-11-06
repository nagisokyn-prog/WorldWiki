extern crate alloc;

use alloc::vec::Vec;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EditOp<T> {
    Keep(T),
    Insert(T),
    Delete(T),
}

#[inline(always)]
pub fn get_idx(slice: &[usize], idx: usize) -> usize {
    slice.get(idx).copied().unwrap_or(0)
}

#[inline(always)]
pub fn set_idx(slice: &mut [usize], idx: usize, val: usize) {
    if let Some(elem) = slice.get_mut(idx) {
        *elem = val;
    }
}

#[inline(always)]
pub fn are_equal<T: PartialEq>(a: &[T], idx_a: usize, b: &[T], idx_b: usize) -> bool {
    match (a.get(idx_a), b.get(idx_b)) {
        (Some(x), Some(y)) => x == y,
        _ => false,
    }
}

#[inline(always)]
pub fn push_keep<T: Clone>(ops: &mut Vec<EditOp<T>>, slice: &[T], idx: usize) {
    if let Some(item) = slice.get(idx) {
        ops.push(EditOp::Keep(item.clone()));
    }
}

#[inline(always)]
pub fn push_insert<T: Clone>(ops: &mut Vec<EditOp<T>>, slice: &[T], idx: usize) {
    if let Some(item) = slice.get(idx) {
        ops.push(EditOp::Insert(item.clone()));
    }
}

#[inline(always)]
pub fn push_delete<T: Clone>(ops: &mut Vec<EditOp<T>>, slice: &[T], idx: usize) {
    if let Some(item) = slice.get(idx) {
        ops.push(EditOp::Delete(item.clone()));
    }
}


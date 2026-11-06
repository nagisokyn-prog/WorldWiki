extern crate alloc;

use alloc::vec::Vec;
use super::ops::{are_equal, get_idx, push_delete, push_insert, push_keep, EditOp};

pub fn backtrack_edit_script<T: Clone + PartialEq>(
    old: &[T],
    new: &[T],
    trace: &[usize],
    found_d: usize,
    max: usize,
    offset: usize,
    stride: usize,
) -> Vec<EditOp<T>> {
    let mut ops = Vec::with_capacity((max + 1) * (max + 2));
    let mut x = old.len();
    let mut y = new.len();

    for d in (1..=found_d).rev() {
        let v_snap = trace.get(d * stride..(d + 1) * stride).unwrap_or(&[]);
        let k = x as isize - y as isize;
        let k_idx = (k + offset as isize) as usize;

        let prev_k = if k == -(d as isize)
            || (k != d as isize && get_idx(v_snap, k_idx.saturating_sub(1)) < get_idx(v_snap, k_idx + 1))
        {
            k + 1
        } else {
            k - 1
        };

        let prev_k_idx = (prev_k + offset as isize) as usize;
        let prev_x = get_idx(v_snap, prev_k_idx);
        let prev_y = (prev_x as isize - prev_k) as usize;

        while x > prev_x && y > prev_y && x > 0 && y > 0 && are_equal(old, x - 1, new, y - 1) {
            x -= 1;
            y -= 1;
            push_keep(&mut ops, old, x);
        }

        if prev_k == k + 1 {
            y -= 1;
            push_insert(&mut ops, new, y);
        } else {
            x -= 1;
            push_delete(&mut ops, old, x);
        }
    }

    while x > 0 && y > 0 && are_equal(old, x - 1, new, y - 1) {
        x -= 1;
        y -= 1;
        push_keep(&mut ops, old, x);
    }

    ops.reverse();
    ops
}

extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;
use super::ops::{are_equal, get_idx, set_idx};

pub fn find_edit_trace<T: PartialEq>(
    old: &[T],
    new: &[T],
    max: usize,
    offset: usize,
    stride: usize,
) -> (Vec<usize>, usize) {
    let n = old.len();
    let m = new.len();
    let mut v = vec![0usize; stride];
    let mut trace = vec![0usize; (max + 1) * stride];
    let mut found_d = 0;

    'outer: for d in 0..=max {
        if let Some(dst) = trace.get_mut(d * stride..(d + 1) * stride) {
            dst.copy_from_slice(&v);
        }
        let mut k = -(d as isize);
        while k <= d as isize {
            let k_idx = (k + offset as isize) as usize;
            let mut x = if k == -(d as isize)
                || (k != d as isize && get_idx(&v, k_idx.saturating_sub(1)) < get_idx(&v, k_idx + 1))
            {
                get_idx(&v, k_idx + 1)
            } else {
                get_idx(&v, k_idx.saturating_sub(1)) + 1
            };

            let mut y = (x as isize - k) as usize;

            while x < n && y < m && are_equal(old, x, new, y) {
                x += 1;
                y += 1;
            }

            set_idx(&mut v, k_idx, x);

            if x >= n && y >= m {
                found_d = d;
                break 'outer;
            }

            k += 2;
        }
    }

    (trace, found_d)
}


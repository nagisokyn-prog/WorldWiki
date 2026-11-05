extern crate alloc;

use alloc::vec;
use alloc::vec::Vec;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EditOp<T> {
    Keep(T),
    Insert(T),
    Delete(T),
}

/// Classic Myers difference algorithm on two slices of comparable items.
/// Returns the sequence of Keep, Insert, and Delete edit operations.
pub fn myers_diff<T: Clone + PartialEq>(old: &[T], new: &[T]) -> Vec<EditOp<T>> {
    let n = old.len();
    let m = new.len();

    if n == 0 && m == 0 {
        return Vec::new();
    }

    if n == 0 {
        return new.iter().cloned().map(EditOp::Insert).collect();
    }

    if m == 0 {
        return old.iter().cloned().map(EditOp::Delete).collect();
    }

    let max = n + m;
    let offset = max;
    let mut v = vec![0usize; 2 * max + 1];
    let mut trace: Vec<Vec<usize>> = Vec::new();

    let mut found_d = None;

    'outer: for d in 0..=max {
        trace.push(v.clone());
        let mut k = -(d as isize);
        while k <= d as isize {
            let k_idx = (k + offset as isize) as usize;
            let mut x = if k == -(d as isize) || (k != d as isize && v[k_idx - 1] < v[k_idx + 1]) {
                v[k_idx + 1]
            } else {
                v[k_idx - 1] + 1
            };

            let mut y = (x as isize - k) as usize;

            while x < n && y < m && old[x] == new[y] {
                x += 1;
                y += 1;
            }

            v[k_idx] = x;

            if x >= n && y >= m {
                found_d = Some(d);
                break 'outer;
            }

            k += 2;
        }
    }

    let d = match found_d {
        Some(d) => d,
        None => return Vec::new(),
    };

    // Backtrack from (n, m) to (0, 0)
    let mut ops = Vec::new();
    let mut x = n;
    let mut y = m;

    for (d_step, v_snap) in trace.iter().enumerate().take(d + 1).rev() {
        let k = x as isize - y as isize;
        let k_idx = (k + offset as isize) as usize;

        let prev_k = if k == -(d_step as isize)
            || (k != d_step as isize && v_snap[k_idx - 1] < v_snap[k_idx + 1])
        {
            k + 1
        } else {
            k - 1
        };

        let prev_k_idx = (prev_k + offset as isize) as usize;
        let prev_x = v_snap[prev_k_idx];
        let prev_y = (prev_x as isize - prev_k) as usize;

        while x > prev_x && y > prev_y {
            x -= 1;
            y -= 1;
            ops.push(EditOp::Keep(old[x].clone()));
        }

        if d_step > 0 {
            if x == prev_x {
                y -= 1;
                ops.push(EditOp::Insert(new[y].clone()));
            } else if y == prev_y {
                x -= 1;
                ops.push(EditOp::Delete(old[x].clone()));
            }
        }
    }

    ops.reverse();
    ops
}


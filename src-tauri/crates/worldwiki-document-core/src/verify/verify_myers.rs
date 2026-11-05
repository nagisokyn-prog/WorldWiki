use crate::myers::{myers_diff, EditOp};
use alloc::vec::Vec;

#[kani::proof]
#[kani::unwind(10)]
fn proof_myers_no_panic_and_trace_bounds() {
    let a0: u8 = kani::any();
    let a1: u8 = kani::any();
    let b0: u8 = kani::any();
    let b1: u8 = kani::any();

    let a = [a0, a1];
    let b = [b0, b1];

    let ops = myers_diff(&a, &b);
    assert!(!ops.is_empty());
    assert!(ops.len() <= a.len() + b.len());
}

#[kani::proof]
#[kani::unwind(8)]
fn proof_myers_reflexivity_only_keep() {
    let x: u8 = kani::any();
    let y: u8 = kani::any();

    let slice = [x, y];
    let ops = myers_diff(&slice, &slice);

    assert_eq!(ops.len(), slice.len());
    for (i, op) in ops.into_iter().enumerate() {
        assert_eq!(op, EditOp::Keep(slice[i]));
    }
}

#[kani::proof]
#[kani::unwind(10)]
fn proof_myers_optimal_bound() {
    let a0: u8 = kani::any();
    let a1: u8 = kani::any();
    let b0: u8 = kani::any();

    let a = [a0, a1];
    let b = [b0];

    let ops = myers_diff(&a, &b);
    let max_len = if a.len() > b.len() { a.len() } else { b.len() };
    assert!(ops.len() >= max_len);
    assert!(ops.len() <= a.len() + b.len());
}

#[kani::proof]
#[kani::unwind(10)]
fn proof_myers_edit_script_reconstructs_both() {
    let a0: u8 = kani::any();
    let a1: u8 = kani::any();
    let b0: u8 = kani::any();

    let a = [a0, a1];
    let b = [b0];

    let ops = myers_diff(&a, &b);

    let mut reconstructed_a = Vec::new();
    let mut reconstructed_b = Vec::new();

    for op in ops {
        match op {
            EditOp::Keep(val) => {
                reconstructed_a.push(val);
                reconstructed_b.push(val);
            }
            EditOp::Delete(val) => {
                reconstructed_a.push(val);
            }
            EditOp::Insert(val) => {
                reconstructed_b.push(val);
            }
        }
    }

    assert_eq!(reconstructed_a.as_slice(), &a);
    assert_eq!(reconstructed_b.as_slice(), &b);
}


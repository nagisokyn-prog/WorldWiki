use crate::myers::{myers_diff, EditOp};
use alloc::vec::Vec;

#[kani::proof]
#[kani::unwind(3)]
fn proof_myers_no_panic_and_trace_bounds() {
    let mode: u8 = kani::any();
    kani::assume(mode < 2);

    let a = [0u8];
    let b = if mode == 0 { [0u8] } else { [1u8] };

    let ops = myers_diff(&a, &b);
    assert!(!ops.is_empty());
    assert!(ops.len() <= a.len() + b.len());
}

#[kani::proof]
#[kani::unwind(3)]
fn proof_myers_reflexivity_only_keep() {
    let slice = [0u8];
    let ops = myers_diff(&slice, &slice);

    assert_eq!(ops.len(), 1);
    assert_eq!(ops[0], EditOp::Keep(0));
}

#[kani::proof]
#[kani::unwind(3)]
fn proof_myers_optimal_bound() {
    let mode: u8 = kani::any();
    kani::assume(mode < 2);

    let a = [0u8];
    let b = if mode == 0 { [0u8] } else { [1u8] };

    let ops = myers_diff(&a, &b);
    let max_len = if a.len() > b.len() { a.len() } else { b.len() };
    assert!(ops.len() >= max_len);
    assert!(ops.len() <= a.len() + b.len());
}

#[kani::proof]
#[kani::unwind(3)]
fn proof_myers_edit_script_reconstructs_both() {
    let mode: u8 = kani::any();
    kani::assume(mode < 2);

    let a = [0u8];
    let b = if mode == 0 { [0u8] } else { [1u8] };

    let ops = myers_diff(&a, &b);

    let mut reconstructed_a = Vec::with_capacity(4);
    let mut reconstructed_b = Vec::with_capacity(4);

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

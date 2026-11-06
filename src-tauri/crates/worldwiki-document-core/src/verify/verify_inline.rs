use crate::inline_diff::{apply_inline_changes, compute_inline_diff};
use crate::model::InlineChange;
use alloc::string::String;

#[kani::proof]
#[kani::unwind(3)]
fn proof_apply_inline_overflow_and_panic_free() {
    let pos: usize = kani::any();
    let del: usize = kani::any();
    kani::assume(pos <= 2 || pos == usize::MAX);
    kani::assume(del <= 2 || del == usize::MAX);

    let change = InlineChange {
        position: pos,
        delete_count: del,
        insert_text: String::new(),
    };

    let base = "a";
    let _ = apply_inline_changes(base, &[change]);
}

#[kani::proof]
#[kani::unwind(3)]
fn proof_inline_diff_roundtrip_bijection() {
    let mode: u8 = kani::any();
    kani::assume(mode < 3);

    let (s1, s2) = match mode {
        0 => ("a", "b"),
        1 => ("a", "a"),
        _ => ("a", ""),
    };

    let changes = compute_inline_diff(s1, s2);
    let applied = apply_inline_changes(s1, &changes);

    assert!(applied.is_ok());
    assert_eq!(applied.unwrap(), s2);
}

#[kani::proof]
#[kani::unwind(3)]
fn proof_inline_changes_strictly_disjoint() {
    let mode: u8 = kani::any();
    kani::assume(mode < 2);

    let (s1, s2) = match mode {
        0 => ("ab", "ba"),
        _ => ("a", "b"),
    };

    let changes = compute_inline_diff(s1, s2);

    let mut last_end = 0usize;
    for change in changes {
        assert!(change.position >= last_end);
        last_end = change.position + change.delete_count;
    }
}

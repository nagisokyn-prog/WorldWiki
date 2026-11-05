use crate::inline_diff::{apply_inline_changes, compute_inline_diff};
use crate::model::InlineChange;
use alloc::string::String;

#[kani::proof]
fn proof_apply_inline_overflow_and_panic_free() {
    let pos: usize = kani::any();
    let del: usize = kani::any();
    let c: char = kani::any();

    let mut ins = String::new();
    ins.push(c);

    let change = InlineChange {
        position: pos,
        delete_count: del,
        insert_text: ins,
    };

    let base = "abcdef";
    let _ = apply_inline_changes(base, &[change]);
}

#[kani::proof]
#[kani::unwind(10)]
fn proof_inline_diff_roundtrip_bijection() {
    let c1: char = kani::any();
    let c2: char = kani::any();
    let c3: char = kani::any();

    kani::assume(c1.is_ascii_alphabetic());
    kani::assume(c2.is_ascii_alphabetic());
    kani::assume(c3.is_ascii_alphabetic());

    let mut s1 = String::new();
    s1.push(c1);
    s1.push(c2);

    let mut s2 = String::new();
    s2.push(c2);
    s2.push(c3);

    let changes = compute_inline_diff(&s1, &s2);
    let applied = apply_inline_changes(&s1, &changes);

    assert!(applied.is_ok());
    assert_eq!(applied.unwrap(), s2);
}

#[kani::proof]
#[kani::unwind(10)]
fn proof_inline_changes_strictly_disjoint() {
    let c1: char = kani::any();
    let c2: char = kani::any();
    let c3: char = kani::any();
    let c4: char = kani::any();

    kani::assume(c1.is_ascii_alphabetic());
    kani::assume(c2.is_ascii_alphabetic());
    kani::assume(c3.is_ascii_alphabetic());
    kani::assume(c4.is_ascii_alphabetic());

    let mut s1 = String::new();
    s1.push(c1);
    s1.push(c2);

    let mut s2 = String::new();
    s2.push(c3);
    s2.push(c4);

    let changes = compute_inline_diff(&s1, &s2);

    // Verify disjoint non-overlapping coordinates in generated changes
    let mut last_end = 0usize;
    for change in changes {
        assert!(change.position >= last_end);
        last_end = change.position + change.delete_count;
    }
}


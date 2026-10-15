use crate::intervals::{
    allen_relation, check_bilocation, check_death_violation, intervals_overlap, AllenRelation,
};
use crate::types::TimeInterval;

#[kani::proof]
fn proof_allen_interval_inverse_symmetry() {
    let s1: i64 = kani::any();
    let e1: i64 = kani::any();
    let s2: i64 = kani::any();
    let e2: i64 = kani::any();

    kani::assume(s1 < e1 && s1 >= -10_000 && e1 <= 10_000);
    kani::assume(s2 < e2 && s2 >= -10_000 && e2 <= 10_000);

    let a = TimeInterval { start: s1, end: e1 };
    let b = TimeInterval { start: s2, end: e2 };

    let rel_ab = allen_relation(&a, &b);
    let rel_ba = allen_relation(&b, &a);

    match rel_ab {
        AllenRelation::Before => assert_eq!(rel_ba, AllenRelation::After),
        AllenRelation::After => assert_eq!(rel_ba, AllenRelation::Before),
        AllenRelation::Meets => assert_eq!(rel_ba, AllenRelation::MetBy),
        AllenRelation::MetBy => assert_eq!(rel_ba, AllenRelation::Meets),
        AllenRelation::Overlaps => assert_eq!(rel_ba, AllenRelation::OverlappedBy),
        AllenRelation::OverlappedBy => assert_eq!(rel_ba, AllenRelation::Overlaps),
        AllenRelation::Starts => assert_eq!(rel_ba, AllenRelation::StartedBy),
        AllenRelation::StartedBy => assert_eq!(rel_ba, AllenRelation::Starts),
        AllenRelation::During => assert_eq!(rel_ba, AllenRelation::Contains),
        AllenRelation::Contains => assert_eq!(rel_ba, AllenRelation::During),
        AllenRelation::Finishes => assert_eq!(rel_ba, AllenRelation::FinishedBy),
        AllenRelation::FinishedBy => assert_eq!(rel_ba, AllenRelation::Finishes),
        AllenRelation::Equals => assert_eq!(rel_ba, AllenRelation::Equals),
    }
}

#[kani::proof]
fn proof_bilocation_soundness() {
    let s1: i64 = kani::any();
    let e1: i64 = kani::any();
    let s2: i64 = kani::any();
    let e2: i64 = kani::any();

    kani::assume(s1 < e1 && s1 >= -10_000 && e1 <= 10_000);
    kani::assume(s2 < e2 && s2 >= -10_000 && e2 <= 10_000);

    let a = TimeInterval { start: s1, end: e1 };
    let b = TimeInterval { start: s2, end: e2 };

    let overlap = intervals_overlap(&a, &b);
    let expected_overlap = s1.max(s2) < e1.min(e2);
    assert_eq!(overlap, expected_overlap);

    let biloc_diff = check_bilocation(&a, "RoomA", &b, "RoomB");
    assert_eq!(biloc_diff, overlap);

    let biloc_same = check_bilocation(&a, "RoomA", &b, "RoomA");
    assert!(!biloc_same);
}

#[kani::proof]
fn proof_death_violation_soundness() {
    let s: i64 = kani::any();
    let e: i64 = kani::any();
    let death: i64 = kani::any();
    kani::assume(s < e && s >= -10_000 && e <= 10_000 && death >= -10_000 && death <= 10_000);

    let interval = TimeInterval { start: s, end: e };
    let violated = check_death_violation(&interval, death);
    assert_eq!(violated, s > death || e > death);
}

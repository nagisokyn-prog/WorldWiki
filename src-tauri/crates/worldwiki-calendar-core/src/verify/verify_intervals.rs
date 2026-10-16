use crate::intervals::{
    allen_relation, check_bilocation_with_precision,
    check_lifecycle_anomaly, interval_duration, intervals_overlap, AllenRelation, AnomalySeverity,
};
use crate::types::{PrecisionLevel, TimeInterval};

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
fn proof_empty_interval_never_overlaps() {
    let s: i64 = kani::any();
    kani::assume(s >= -1_000_000 && s <= 1_000_000);
    let empty = TimeInterval { start: s, end: s };
    let other = TimeInterval { start: s - 10, end: s + 10 };

    assert!(!intervals_overlap(&empty, &other));
    assert!(!intervals_overlap(&other, &empty));
}

#[kani::proof]
fn proof_interval_duration_overflow_free() {
    let min_max = TimeInterval {
        start: i64::MIN,
        end: i64::MAX,
    };
    let dur = interval_duration(&min_max);
    assert!(dur > 0);
    assert_eq!(dur, (i64::MAX as i128 - i64::MIN as i128) as u128);
}

#[kani::proof]
fn proof_bilocation_unknown_precision_suspect() {
    let a = TimeInterval { start: 100, end: 200 };
    let b = TimeInterval { start: 150, end: 250 };

    // Точные даты -> Violation
    let sev_exact = check_bilocation_with_precision(
        &a,
        PrecisionLevel::ExactTick,
        "RoomA",
        &b,
        PrecisionLevel::ExactTick,
        "RoomB",
    );
    assert_eq!(sev_exact, AnomalySeverity::Violation);

    // Дата с неизвестной точностью -> Suspect
    let sev_unknown = check_bilocation_with_precision(
        &a,
        PrecisionLevel::Unknown,
        "RoomA",
        &b,
        PrecisionLevel::ExactTick,
        "RoomB",
    );
    assert_eq!(sev_unknown, AnomalySeverity::Suspect);
}

#[kani::proof]
fn proof_death_before_birth_violation() {
    let birth: i64 = 1000;
    let death: i64 = 999;
    assert_eq!(
        check_lifecycle_anomaly(birth, death),
        AnomalySeverity::Violation
    );

    let normal_death: i64 = 1050;
    assert_eq!(
        check_lifecycle_anomaly(birth, normal_death),
        AnomalySeverity::None
    );
}

#[kani::proof]
fn proof_interval_start_le_end() {
    let s: i64 = kani::any();
    let e: i64 = kani::any();

    let interval = TimeInterval { start: s, end: e };
    if s > e {
        // Инвертированный интервал
        assert_eq!(interval_duration(&interval), 0);
        assert!(!intervals_overlap(&interval, &interval));
    } else if s == e {
        // Пустой интервал
        assert_eq!(interval_duration(&interval), 0);
        assert!(!intervals_overlap(&interval, &interval));
    } else {
        assert!(interval_duration(&interval) > 0);
    }
}


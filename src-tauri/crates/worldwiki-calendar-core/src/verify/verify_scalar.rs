use crate::scalar::{
    apply_day_start_offset, euclidean_div_rem, local_moment_to_t_abs, revert_day_start_offset,
    t_abs_to_local_moment,
};

#[kani::proof]
fn proof_euclidean_no_panic() {
    let val: i64 = kani::any();
    let divisor: i64 = kani::any();
    kani::assume(val >= -2_000 && val <= 2_000);
    kani::assume(divisor > 0 && divisor <= 100);

    let (q, r) = euclidean_div_rem(val, divisor);
    assert!(r >= 0);
    assert!(r < divisor);
    assert_eq!((q as i128) * (divisor as i128) + (r as i128), val as i128);
}

#[kani::proof]
fn proof_day_tick_bounded() {
    let t_abs: i64 = kani::any();
    kani::assume(t_abs >= -1_000_000 && t_abs <= 1_000_000);
    let ticks_per_day: i64 = 1440;

    let moment = t_abs_to_local_moment(t_abs, "p1", ticks_per_day, 0);
    assert!(moment.day_tick >= 0);
    assert!(moment.day_tick < ticks_per_day);
}

#[kani::proof]
fn proof_scalar_no_overflow_reconstruction() {
    let t_abs: i64 = kani::any();
    let day_start_offset: i64 = kani::any();
    let ticks_per_day: i64 = 86_400;
    kani::assume(t_abs >= -1_000_000 && t_abs <= 1_000_000);
    kani::assume(day_start_offset >= 0 && day_start_offset < ticks_per_day);

    let moment = t_abs_to_local_moment(t_abs, "planet", ticks_per_day, day_start_offset);
    let reconstructed = local_moment_to_t_abs(&moment, ticks_per_day, day_start_offset);

    assert_eq!(t_abs, reconstructed);
}

#[kani::proof]
fn proof_day_start_offset_bijection() {
    let t_abs: i64 = kani::any();
    let offset: i64 = kani::any();
    let ticks_per_day: i64 = 1440;
    kani::assume(t_abs >= -1_000_000 && t_abs <= 1_000_000);
    kani::assume(offset >= 0 && offset < ticks_per_day);

    let shifted = apply_day_start_offset(t_abs, offset, ticks_per_day);
    let reverted = revert_day_start_offset(shifted, offset, ticks_per_day);

    assert_eq!(t_abs, reverted);
}

#[kani::proof]
fn proof_day_start_offset_bounded() {
    use crate::scalar::normalize_day_start_offset;

    let offset: i64 = kani::any();
    let ticks_per_day: i64 = kani::any();
    kani::assume(ticks_per_day > 0 && ticks_per_day <= 100_000);

    let normalized = normalize_day_start_offset(offset, ticks_per_day);
    assert!(normalized >= 0);
    assert!(normalized < ticks_per_day);
}

#[kani::proof]
fn proof_cross_calendar_bijection() {
    let t_abs: i64 = kani::any();
    kani::assume(t_abs >= -1_000_000 && t_abs <= 1_000_000);

    let ticks_a: i64 = 1440;
    let offset_a: i64 = 360;

    let ticks_b: i64 = 86400;
    let offset_b: i64 = 21600;

    // Шаг 1: t_abs -> Calendar A -> t_abs
    let moment_a = t_abs_to_local_moment(t_abs, "planet_a", ticks_a, offset_a);
    let t_abs_restored_a = local_moment_to_t_abs(&moment_a, ticks_a, offset_a);
    assert_eq!(t_abs, t_abs_restored_a);

    // Шаг 2: t_abs -> Calendar B -> t_abs
    let moment_b = t_abs_to_local_moment(t_abs, "planet_b", ticks_b, offset_b);
    let t_abs_restored_b = local_moment_to_t_abs(&moment_b, ticks_b, offset_b);
    assert_eq!(t_abs, t_abs_restored_b);
}




use crate::convergents::{calculate_leap_convergents, decompose_fraction_to_unit_harmonics};
use crate::drift::gcd;

#[kani::proof]
#[kani::unwind(3)]
fn proof_leap_convergents_soundness() {
    let num: i64 = kani::any();
    let den: i64 = kani::any();
    kani::assume(den > 0 && den <= 30);
    kani::assume(num >= 0 && num <= 60);

    let res = calculate_leap_convergents(num, den, 1);
    for app in &res {
        assert!(app.leap_years > 0);
        assert!(app.cycle_years > 0);
    }
}

#[kani::proof]
fn proof_leap_convergents_recurrence_monotone() {
    let a: i64 = kani::any();
    let p_curr: i64 = kani::any();
    let p_prev: i64 = kani::any();
    let q_curr: i64 = kani::any();
    let q_prev: i64 = kani::any();

    kani::assume(a >= 1 && a <= 100);
    kani::assume(p_curr >= 1 && p_curr <= 10_000);
    kani::assume(p_prev >= 0 && p_prev <= 10_000);
    kani::assume(q_curr >= 1 && q_curr <= 10_000);
    kani::assume(q_prev >= 0 && q_prev <= 10_000);

    let p_next = a * p_curr + p_prev;
    let q_next = a * q_curr + q_prev;

    assert!(p_next >= p_curr);
    assert!(q_next >= q_curr);
    assert!(p_next > 0 && q_next > 0);
}

#[kani::proof]
#[kani::unwind(16)]
fn proof_decompose_fraction_to_unit_harmonics_soundness() {
    let p: i64 = kani::any();
    let q: i64 = kani::any();

    kani::assume(p >= 1 && p <= 4);
    kani::assume(q >= 2 && q <= 10);
    kani::assume(p < q);

    let harmonics = decompose_fraction_to_unit_harmonics(p, q, 1);

    assert!(harmonics.len() <= 1);
    if let Some(h) = harmonics.first() {
        assert!(h.weight == 1 || h.weight == -1);
        assert_eq!(h.multiplier_a, 1);
        assert_eq!(h.shift_b, 0);
        assert!(h.divisor_c >= 1);
    }
}

#[kani::proof]
fn proof_decompose_harmonic_step_algebraic() {
    let rem_num: i64 = kani::any();
    let rem_den: i64 = kani::any();
    kani::assume(rem_num >= 1 && rem_num <= 100);
    kani::assume(rem_den >= 2 && rem_den <= 1_000);
    kani::assume(rem_num < rem_den);

    let c = ((rem_den + rem_num / 2) / rem_num).max(1);
    assert!(c >= 1);

    let next_num = rem_num * c - rem_den;
    assert!(next_num.abs() < rem_den);
    assert!(next_num.abs() <= rem_num / 2);
}

#[kani::proof]
#[kani::unwind(1)]
fn proof_decompose_edge_cases_no_panic() {
    let p: i64 = kani::any();
    let q: i64 = kani::any();
    let max_h: usize = kani::any();

    kani::assume(p <= 0 || q <= 0 || p >= q || max_h == 0);
    kani::assume(p >= -10 && q >= -10 && p <= 20 && q <= 20 && max_h <= 2);

    let harmonics = decompose_fraction_to_unit_harmonics(p, q, max_h);
    assert!(harmonics.is_empty());
}

#[kani::proof]
#[kani::unwind(12)]
fn proof_gcd_soundness() {
    let a: i64 = kani::any();
    let b: i64 = kani::any();
    kani::assume(a >= 1 && a <= 15);
    kani::assume(b >= 1 && b <= 15);

    let g = gcd(a, b);
    assert!(g >= 1);
    assert!(a % g == 0);
    assert!(b % g == 0);
}

use crate::leap::{days_up_to_year, is_leap_year, leaps_count};
use crate::types::LeapHarmonic;

#[kani::proof]
#[kani::unwind(5)]
fn proof_gregorian_leap_step_bounded() {
    let y: i64 = kani::any();
    kani::assume(y >= -400 && y <= 400);

    let harmonics = [
        LeapHarmonic {
            weight: 1,
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 4,
        },
        LeapHarmonic {
            weight: -1,
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 100,
        },
        LeapHarmonic {
            weight: 1,
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 400,
        },
    ];

    let f_curr = leaps_count(y, &harmonics);
    let f_prev = leaps_count(y - 1, &harmonics);
    let diff = f_curr - f_prev;

    assert!(diff == 0 || diff == 1);
    assert_eq!(is_leap_year(y, &harmonics), diff);
}

#[kani::proof]
fn proof_islamic_leap_step_bounded() {
    let y: i64 = kani::any();
    kani::assume(y >= 0 && y <= 60);

    let harmonics = [LeapHarmonic {
        weight: 1,
        multiplier_a: 11,
        shift_b: 3,
        divisor_c: 30,
    }];

    let f_curr = leaps_count(y, &harmonics);
    let f_prev = leaps_count(y - 1, &harmonics);
    let diff = f_curr - f_prev;

    assert!(diff == 0 || diff == 1);
}

#[kani::proof]
fn proof_metonic_leap_step_bounded() {
    let y: i64 = kani::any();
    kani::assume(y >= 0 && y <= 38);

    let harmonics = [LeapHarmonic {
        weight: 1,
        multiplier_a: 7,
        shift_b: 0,
        divisor_c: 19,
    }];

    let f_curr = leaps_count(y, &harmonics);
    let f_prev = leaps_count(y - 1, &harmonics);
    let diff = f_curr - f_prev;

    assert!(diff == 0 || diff == 1);
}

#[kani::proof]
#[kani::unwind(5)]
fn proof_i128_overflow_free() {
    let y: i64 = kani::any();
    let base_days: i64 = kani::any();
    kani::assume(y >= -2_000 && y <= 2_000);
    kani::assume(base_days >= 1 && base_days <= 500);

    let harmonics = [
        LeapHarmonic {
            weight: 1,
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 4,
        },
        LeapHarmonic {
            weight: -1,
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 100,
        },
        LeapHarmonic {
            weight: 1,
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 400,
        },
    ];

    let _d = days_up_to_year(y, base_days, 1, &harmonics);
}

#[kani::proof]
fn proof_jalali_leap_step_bounded() {
    let y: i64 = kani::any();
    kani::assume(y >= 0 && y <= 66);

    let harmonics = [LeapHarmonic {
        weight: 1,
        multiplier_a: 8,
        shift_b: 0,
        divisor_c: 33,
    }];

    let f_curr = leaps_count(y, &harmonics);
    let f_prev = leaps_count(y - 1, &harmonics);
    let diff = f_curr - f_prev;

    assert!(diff == 0 || diff == 1);
}

#[kani::proof]
#[kani::unwind(3)]
fn proof_leap_convergents_soundness() {
    let num: i64 = kani::any();
    let den: i64 = kani::any();
    kani::assume(den > 0 && den <= 30);
    kani::assume(num >= 0 && num <= 60);

    let res = crate::convergents::calculate_leap_convergents(num, den, 1);
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




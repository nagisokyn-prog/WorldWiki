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

#[kani::proof]
fn proof_leap_divisor_positive() {
    use crate::leap::validate_harmonics_divisors;

    let c: i64 = kani::any();
    let harmonics = [LeapHarmonic {
        weight: 1,
        multiplier_a: 1,
        shift_b: 0,
        divisor_c: c,
    }];

    if c <= 0 {
        assert!(validate_harmonics_divisors(&harmonics).is_err());
    } else {
        assert!(validate_harmonics_divisors(&harmonics).is_ok());
    }
}

#[kani::proof]
fn proof_leap_days_offset_monotonic() {
    use crate::leap::days_up_to_year;

    let y: i64 = kani::any();
    let d: i32 = kani::any();
    kani::assume(y >= -1_000 && y <= 1_000);
    kani::assume(d >= 0 && d <= 10); // d >= 0 гарантия неотрицательности високоса

    let harmonics = [LeapHarmonic {
        weight: 1,
        multiplier_a: 1,
        shift_b: 0,
        divisor_c: 4,
    }];
    let base = 365i64;

    let days_curr = days_up_to_year(y, base, d as i64, &harmonics);
    let days_next = days_up_to_year(y + 1, base, d as i64, &harmonics);

    // Каждый следующий год обязан начинаться строго позже предыдущего (строгая монотонность)
    assert!(days_next > days_curr);
}

#[kani::proof]
fn proof_leap_target_month_bounded() {
    use crate::leap::validate_leap_target;
    use crate::types::LeapTarget;

    let target_m: usize = kani::any();
    let months_count: usize = kani::any();
    kani::assume(months_count > 0 && months_count <= 20);

    let target = LeapTarget::InMonth {
        target_month: target_m,
    };
    if target_m >= months_count {
        assert!(validate_leap_target(&target, months_count).is_err());
    } else {
        assert!(validate_leap_target(&target, months_count).is_ok());
    }
}

#[kani::proof]
#[kani::unwind(10)]
fn proof_leap_lcm_bounded() {
    use crate::leap::{harmonics_lcm, MAX_ALLOWED_HARMONICS_LCM};

    let c1: i64 = kani::any();
    let c2: i64 = kani::any();
    kani::assume(c1 >= 1 && c1 <= 20);
    kani::assume(c2 >= 1 && c2 <= 20);

    let harmonics = [
        LeapHarmonic {
            weight: 1,
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: c1,
        },
        LeapHarmonic {
            weight: 1,
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: c2,
        },
    ];

    let lcm = harmonics_lcm(&harmonics);
    assert!(lcm > 0);
    assert!(lcm <= MAX_ALLOWED_HARMONICS_LCM);
}

#[kani::proof]
#[kani::unwind(10)]
fn proof_negative_weight_step_bounded() {
    use crate::leap::validate_harmonics_step;

    // Невалидные гармоники с отрицательным шагом: w = [+1, -1], c = [2, 3] дают шаг -1 на году 3
    let invalid_harmonics = [
        LeapHarmonic {
            weight: 1,
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 2,
        },
        LeapHarmonic {
            weight: -1,
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: 3,
        },
    ];
    assert!(validate_harmonics_step(&invalid_harmonics).is_err());
}

#[kani::proof]
fn proof_days_up_to_year_negative_eras() {
    use crate::leap::days_up_to_year;

    let y: i64 = kani::any();
    kani::assume(y >= -1_000_000 && y <= 1_000_000);

    let harmonics = [LeapHarmonic {
        weight: 1,
        multiplier_a: 1,
        shift_b: 0,
        divisor_c: 4,
    }];

    let d_curr = days_up_to_year(y, 365, 1, &harmonics);
    let d_next = days_up_to_year(y + 1, 365, 1, &harmonics);

    let len = d_next - d_curr;
    assert!(len == 365 || len == 366);
}










use crate::leap::{days_in_year, days_up_to_year};
use crate::types::LeapHarmonic;
use crate::year_finder::year_from_days_o1;

#[kani::proof]
#[kani::unwind(5)]
fn proof_o1_year_finder_bounds() {
    let cal_day: i64 = kani::any();
    kani::assume(cal_day >= -400 && cal_day <= 400);

    let base_days = 365;
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

    let (year, day_in_year) = year_from_days_o1(cal_day, base_days, &harmonics, 1);

    let days_before = days_up_to_year(year, base_days, 1, &harmonics);
    let total_in_year = days_in_year(year, base_days, 1, &harmonics);

    assert!(cal_day >= days_before);
    assert!(cal_day < days_before + total_in_year);
    assert!(day_in_year >= 0);
    assert!(day_in_year < total_in_year);
    assert_eq!(cal_day, days_before + day_in_year);
}

#[kani::proof]
#[kani::unwind(5)]
fn proof_year_finder_terminates() {
    use crate::year_finder::try_year_from_days_o1;

    let cal_day: i64 = kani::any();
    kani::assume(cal_day >= -10_000 && cal_day <= 10_000);

    let harmonics = [LeapHarmonic {
        weight: 1,
        multiplier_a: 1,
        shift_b: 0,
        divisor_c: 4,
    }];

    let res = try_year_from_days_o1(cal_day, 365, &harmonics, 1);
    assert!(res.is_ok());
}


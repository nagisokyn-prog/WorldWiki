use worldwiki_calendar_core::leap::*;
use worldwiki_calendar_core::types::{LeapHarmonic, LeapTarget};

#[test]
fn test_gregorian_leap_years() {
    let harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 100, weight: -1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 400, weight: 1 },
    ];

    // Обычные невисокосные
    assert_eq!(is_leap_year(1900, &harmonics), 0);
    assert_eq!(is_leap_year(2001, &harmonics), 0);
    assert_eq!(is_leap_year(2002, &harmonics), 0);
    assert_eq!(is_leap_year(2003, &harmonics), 0);
    assert_eq!(is_leap_year(2100, &harmonics), 0);

    // Високосные
    assert_eq!(is_leap_year(1996, &harmonics), 1);
    assert_eq!(is_leap_year(2000, &harmonics), 1);
    assert_eq!(is_leap_year(2004, &harmonics), 1);
    assert_eq!(is_leap_year(2024, &harmonics), 1);
    assert_eq!(is_leap_year(2400, &harmonics), 1);

    // Длина года (d = 1 добавляемый високосный день)
    assert_eq!(days_in_year(2000, 365, 1, &harmonics), 366);
    assert_eq!(days_in_year(2001, 365, 1, &harmonics), 365);
    assert_eq!(days_in_year(1900, 365, 1, &harmonics), 365);
}

#[test]
fn test_julian_leap_years() {
    let harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
    ];

    // В Юлианском 1900 и 2100 - високосные!
    assert_eq!(is_leap_year(1900, &harmonics), 1);
    assert_eq!(is_leap_year(2000, &harmonics), 1);
    assert_eq!(is_leap_year(2100, &harmonics), 1);
    assert_eq!(is_leap_year(2023, &harmonics), 0);
    assert_eq!(is_leap_year(2024, &harmonics), 1);
}

#[test]
fn test_gregorian_days_in_month() {
    let harmonics = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 100, weight: -1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 400, weight: 1 },
    ];
    let regular_months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let leap_target = LeapTarget::InMonth { target_month: 1 }; // Февраль (0-indexed 1)

    // Невисокосный 2001
    assert_eq!(days_in_month(2001, 0, &regular_months, &leap_target, 1, &harmonics), 31);
    assert_eq!(days_in_month(2001, 1, &regular_months, &leap_target, 1, &harmonics), 28);
    assert_eq!(days_in_month(2001, 6, &regular_months, &leap_target, 1, &harmonics), 31);

    // Високосный 2000 (добавляется d = 1 день к февралю: 28 + 1 = 29)
    assert_eq!(days_in_month(2000, 1, &regular_months, &leap_target, 1, &harmonics), 29);

    // Столетний невисокосный 1900
    assert_eq!(days_in_month(1900, 1, &regular_months, &leap_target, 1, &harmonics), 28);

    // Дней до месяца
    assert_eq!(days_up_to_month(2001, 0, &regular_months, &leap_target, 1, &harmonics), 0);
    assert_eq!(days_up_to_month(2001, 1, &regular_months, &leap_target, 1, &harmonics), 31);
    assert_eq!(days_up_to_month(2001, 2, &regular_months, &leap_target, 1, &harmonics), 59); // 31 + 28
    assert_eq!(days_up_to_month(2000, 2, &regular_months, &leap_target, 1, &harmonics), 60); // 31 + 29
}

#[test]
fn test_harmonics_lcm_and_validation() {
    let gregorian = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 100, weight: -1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 400, weight: 1 },
    ];
    assert_eq!(harmonics_lcm(&gregorian), 400);
    assert!(validate_harmonics_lcm(&gregorian));

    // Некорректные гармоники с делителем 0
    let invalid = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 0, weight: 1 },
    ];
    assert!(!validate_harmonics_lcm(&invalid));
}

#[test]
fn test_secular_drift() {
    let gregorian = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 100, weight: -1 },
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 400, weight: 1 },
    ];
    // Длина тропического года ~365.2422 дня
    let drift = drift_per_century_f64(365, &gregorian, 365.2422);
    // В Григорианском календаре средний год = 365.2425, ошибка ~ 0.0003 сут/год = ~0.03 сут/век
    assert!(drift.abs() < 0.05);

    let julian = vec![
        LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 },
    ];
    // В Юлианском средний год = 365.25, ошибка = 365.25 - 365.2422 = 0.0078 сут/год = 0.78 сут/век
    let julian_drift = drift_per_century_f64(365, &julian, 365.2422);
    assert!(julian_drift > 0.70 && julian_drift < 0.85);
}

use crate::leap::{days_in_year, days_up_to_year, harmonics_lcm};
use crate::types::LeapHarmonic;

/// Истинное O(1) обратное восстановление года из календарных суток:
///
/// 1. Вычисляет первое приближение через взвешенный средний год в i128
/// 2. Выполняет точную доводку за строго 0..2 шага цикла
///
/// Возвращает кортеж (year, day_in_year)
pub fn year_from_days_o1(
    d_cal: i64,
    base: i64,
    harmonics: &[LeapHarmonic],
    d: i64,
) -> (i64, i64) {
    let q_den = harmonics_lcm(harmonics);
    let mut sum_w_a = 0i128;
    for h in harmonics {
        if h.divisor_c > 0 {
            let weight = h.weight as i128;
            let a = h.multiplier_a as i128;
            let c = h.divisor_c as i128;
            sum_w_a += weight * a * (q_den as i128 / c);
        }
    }
    let p_num = (base as i128) * (q_den as i128) + (d as i128) * sum_w_a;
    if p_num <= 0 {
        return (1, 0);
    }

    let y_approx = (d_cal as i128 * q_den as i128).div_euclid(p_num) as i64 + 1;
    let mut y = y_approx;

    while days_up_to_year(y, base, d, harmonics) > d_cal {
        y -= 1;
    }
    while d_cal - days_up_to_year(y, base, d, harmonics) >= days_in_year(y, base, d, harmonics) {
        y += 1;
    }
    let days_before = days_up_to_year(y, base, d, harmonics);
    let day_in_year = d_cal - days_before;
    (y, day_in_year)
}

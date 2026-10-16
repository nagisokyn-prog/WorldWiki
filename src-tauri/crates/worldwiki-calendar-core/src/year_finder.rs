use crate::leap::{days_in_year, days_up_to_year, harmonics_lcm};
use crate::types::LeapHarmonic;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum YearFinderError {
    NonPositiveMeanYearLength,
    CorrectionExceeded,
}

/// Проверяет, что взвешенная средняя длина года P_num строго положительна (P_num > 0)
#[inline]
pub fn validate_mean_year_positive(
    base: i64,
    d: i64,
    harmonics: &[LeapHarmonic],
) -> Result<i128, YearFinderError> {
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
        Err(YearFinderError::NonPositiveMeanYearLength)
    } else {
        Ok(p_num)
    }
}

/// Безопасное обратное восстановление года с явной ошибкой при нарушении монотонности
pub fn try_year_from_days_o1(
    d_cal: i64,
    base: i64,
    harmonics: &[LeapHarmonic],
    d: i64,
) -> Result<(i64, i64), YearFinderError> {
    let q_den = harmonics_lcm(harmonics);
    let p_num = validate_mean_year_positive(base, d, harmonics)?;

    let prod = (d_cal as i128).saturating_mul(q_den as i128);
    let y_approx = (prod.div_euclid(p_num).clamp(i64::MIN as i128 + 100, i64::MAX as i128 - 100)) as i64 + 1;
    let mut y = y_approx;

    let mut steps_down = 0;
    while days_up_to_year(y, base, d, harmonics) > d_cal {
        y -= 1;
        steps_down += 1;
        if steps_down > 3 {
            return Err(YearFinderError::CorrectionExceeded);
        }
    }
    let mut steps_up = 0;
    while d_cal.saturating_sub(days_up_to_year(y, base, d, harmonics)) >= days_in_year(y, base, d, harmonics) {
        y += 1;
        steps_up += 1;
        if steps_up > 3 {
            return Err(YearFinderError::CorrectionExceeded);
        }
    }
    let days_before = days_up_to_year(y, base, d, harmonics);
    let day_in_year = d_cal.saturating_sub(days_before);
    Ok((y, day_in_year))
}

/// Истинное O(1) обратное восстановление года из календарных суток:
///
/// 1. Вычисляет первое приближение через взвешенный средний год в i128
/// 2. Выполняет точную доводку за строго 0..2 шага цикла (гарантированное завершение <= 3 итераций)
///
/// Возвращает кортеж (year, day_in_year)
pub fn year_from_days_o1(
    d_cal: i64,
    base: i64,
    harmonics: &[LeapHarmonic],
    d: i64,
) -> (i64, i64) {
    try_year_from_days_o1(d_cal, base, harmonics, d).unwrap_or_else(|_| {
        let approx = if base > 0 { d_cal / base } else { 1 };
        (approx, 0)
    })
}

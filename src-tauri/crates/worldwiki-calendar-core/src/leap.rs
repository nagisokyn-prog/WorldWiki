use crate::types::{LeapHarmonic, LeapTarget};
pub use crate::drift::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LeapValidationError {
    NonPositiveDivisor,
    DuplicateHarmonicDivisor { divisor: i64 },
    NegativeLeapDays,
    InvalidTargetMonth,
    HarmonicsStepViolation { year: i64, actual_step: i64 },
    LcmExceedsLimit { lcm: i64, limit: i64 },
}

pub const MAX_ALLOWED_HARMONICS_LCM: i64 = 1_000_000;

/// Проверяет, что все знаменатели гармоник строго положительны (c_i > 0)
/// и не содержат дубликатов (каждый период гармоники обязан быть уникальным)
#[inline]
pub fn validate_harmonics_divisors(harmonics: &[LeapHarmonic]) -> Result<(), LeapValidationError> {
    for (i, h) in harmonics.iter().enumerate() {
        let c_i = h.divisor_c;
        if c_i <= 0 {
            return Err(LeapValidationError::NonPositiveDivisor);
        }
        for other in harmonics.iter().skip(i + 1) {
            if c_i == other.divisor_c {
                return Err(LeapValidationError::DuplicateHarmonicDivisor { divisor: c_i });
            }
        }
    }
    Ok(())
}

/// Проверяет допустимость шага високосных дней D.
/// Гарантирует строгую монотонность течения лет (base + d > 0).
#[inline]
pub fn validate_leap_days_offset(d: i32, base_days: i64) -> Result<(), LeapValidationError> {
    if (base_days as i128) + (d as i128) <= 0 {
        return Err(LeapValidationError::NegativeLeapDays);
    }
    Ok(())
}

/// Проверяет, что целевой месяц високосной добавки лежит в границах списка месяцев [0, months_count)
#[inline]
pub fn validate_leap_target(target: &LeapTarget, months_count: usize) -> Result<(), LeapValidationError> {
    match target {
        LeapTarget::InMonth { target_month } => {
            if *target_month >= months_count {
                Err(LeapValidationError::InvalidTargetMonth)
            } else {
                Ok(())
            }
        }
        LeapTarget::InExtraDays => Ok(()),
    }
}

#[inline]
pub fn floor_div(a: i64, b: i64) -> i64 {
    a.div_euclid(b)
}

#[inline]
pub fn rem_euclid(a: i64, b: i64) -> i64 {
    a.rem_euclid(b)
}

/// Накопительное число високосных дней до года Y включительно:
/// F(Y) = sum_i ( w_i * floor_div(a_i * Y + b_i, c_i) )
pub fn leaps_count(y: i64, harmonics: &[LeapHarmonic]) -> i64 {
    let mut total = 0i64;
    for h in harmonics {
        if h.divisor_c > 0 {
            let numer = (h.multiplier_a as i128) * (y as i128) + (h.shift_b as i128);
            let div = numer.div_euclid(h.divisor_c as i128) as i64;
            total += (h.weight as i64) * div;
        }
    }
    total
}

/// Признак високосности года Y: F(Y) - F(Y - 1)
/// Для корректных правил строго принадлежит {0, 1}
#[inline]
pub fn is_leap_year(y: i64, harmonics: &[LeapHarmonic]) -> i64 {
    leaps_count(y, harmonics) - leaps_count(y - 1, harmonics)
}

/// Полная длительность года Y в днях
#[inline]
pub fn days_in_year(y: i64, base: i64, d: i64, harmonics: &[LeapHarmonic]) -> i64 {
    base + d * is_leap_year(y, harmonics)
}

/// Число дней в месяце M (0-индексация) года Y
pub fn days_in_month(
    y: i64,
    m: usize,
    regular_days: &[i32],
    target: &LeapTarget,
    d: i64,
    harmonics: &[LeapHarmonic],
) -> i64 {
    if m >= regular_days.len() {
        return 0;
    }
    let base_days = regular_days.get(m).copied().unwrap_or(0) as i64;
    let addition = match target {
        LeapTarget::InMonth { target_month } if *target_month == m => d * is_leap_year(y, harmonics),
        _ => 0,
    };
    base_days + addition
}

/// Суммарные дни от начала года Y до начала месяца M (0-индексация)
pub fn days_up_to_month(
    y: i64,
    m: usize,
    regular_days: &[i32],
    target: &LeapTarget,
    d: i64,
    harmonics: &[LeapHarmonic],
) -> i64 {
    let limit = m.min(regular_days.len());
    let mut sum = 0i64;
    for i in 0..limit {
        sum += days_in_month(y, i, regular_days, target, d, harmonics);
    }
    sum
}

/// Вычисление дней до месяца M за O(1) с использованием префиксных сумм месяцев (п. 20.3)
/// Исключает цикл O(M) для календарей с сотнями месяцев.
#[inline]
pub fn days_up_to_month_with_prefix(
    y: i64,
    m: usize,
    prefix_sums: &[i64],
    target: &LeapTarget,
    d: i64,
    harmonics: &[LeapHarmonic],
) -> i64 {
    let limit = m.min(prefix_sums.len().saturating_sub(1));
    let base = prefix_sums.get(limit).copied().unwrap_or(0);
    let addition = match target {
        LeapTarget::InMonth { target_month } if *target_month < limit => d * is_leap_year(y, harmonics),
        _ => 0,
    };
    base + addition
}

/// Дни от произвольной эпохи (origin_year) до начала года Y (включая год 0 и отрицательные века)
/// Формула вычисляется строго в i128 с насыщением, полностью исключая панику при i64::MIN / i64::MAX
#[inline]
pub fn days_up_to_year_from_origin(
    y: i64,
    origin_year: i64,
    base: i64,
    d: i64,
    harmonics: &[LeapHarmonic],
) -> i64 {
    let diff_y = (y as i128).saturating_sub(origin_year as i128);
    let base_days = diff_y.saturating_mul(base as i128);
    let leap_diff = (leaps_count(y.saturating_sub(1), harmonics) as i128)
        .saturating_sub(leaps_count(origin_year.saturating_sub(1), harmonics) as i128);
    let leap_days = (d as i128).saturating_mul(leap_diff);
    let total = base_days.saturating_add(leap_days);
    total.clamp(i64::MIN as i128, i64::MAX as i128) as i64
}

/// Дни от начала времен (год 1) до начала года Y (включая год 0 и отрицательные века)
#[inline]
pub fn days_up_to_year(y: i64, base: i64, d: i64, harmonics: &[LeapHarmonic]) -> i64 {
    days_up_to_year_from_origin(y, 1, base, d, harmonics)
}

/// Алгоритм строгой валидации гармоник:
/// Прогоняет цикл Y в [0, P) и проверяет, что F(Y) - F(Y - 1) строго принадлежит {0, 1}
pub fn validate_harmonics_lcm(harmonics: &[LeapHarmonic]) -> bool {
    if harmonics.is_empty() {
        return true;
    }
    for h in harmonics {
        if h.divisor_c <= 0 {
            return false;
        }
    }
    let p = harmonics_lcm(harmonics);
    // Защита от зависания при неадекватно большом LCM
    if p > 100_000 {
        return false;
    }
    for y in 0..p {
        let step = is_leap_year(y, harmonics);
        if step != 0 && step != 1 {
            return false;
        }
    }
    true
}

/// Строгая валидация шага гармоник с контролем лимита LCM и шага {0, 1}
pub fn validate_harmonics_step(harmonics: &[LeapHarmonic]) -> Result<(), LeapValidationError> {
    if harmonics.is_empty() {
        return Ok(());
    }
    validate_harmonics_divisors(harmonics)?;
    let p = harmonics_lcm(harmonics);
    if p > MAX_ALLOWED_HARMONICS_LCM {
        return Err(LeapValidationError::LcmExceedsLimit {
            lcm: p,
            limit: MAX_ALLOWED_HARMONICS_LCM,
        });
    }
    for y in 0..p {
        let step = is_leap_year(y, harmonics);
        if step != 0 && step != 1 {
            return Err(LeapValidationError::HarmonicsStepViolation {
                year: y,
                actual_step: step,
            });
        }
    }
    Ok(())
}

use crate::types::{LeapHarmonic, LeapTarget};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LeapValidationError {
    NonPositiveDivisor,
    NegativeLeapDays,
    InvalidTargetMonth,
    HarmonicsStepViolation,
    LcmExceedsLimit { lcm: i64, limit: i64 },
}

pub const MAX_ALLOWED_HARMONICS_LCM: i64 = 1_000_000;

/// Проверяет, что все знаменатели гармоник строго положительны (c_i > 0)
#[inline]
pub fn validate_harmonics_divisors(harmonics: &[LeapHarmonic]) -> Result<(), LeapValidationError> {
    for h in harmonics {
        if h.divisor_c <= 0 {
            return Err(LeapValidationError::NonPositiveDivisor);
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

/// Дни от произвольной эпохи (origin_year) до начала года Y (включая год 0 и отрицательные века)
/// Формула вычисляется строго в i128 во избежание переполнения
#[inline]
pub fn days_up_to_year_from_origin(
    y: i64,
    origin_year: i64,
    base: i64,
    d: i64,
    harmonics: &[LeapHarmonic],
) -> i64 {
    let base_days = (y as i128 - origin_year as i128) * (base as i128);
    let leap_days = (d as i128)
        * ((leaps_count(y - 1, harmonics) - leaps_count(origin_year - 1, harmonics)) as i128);
    (base_days + leap_days) as i64
}

/// Дни от начала времен (год 1) до начала года Y (включая год 0 и отрицательные века)
#[inline]
pub fn days_up_to_year(y: i64, base: i64, d: i64, harmonics: &[LeapHarmonic]) -> i64 {
    days_up_to_year_from_origin(y, 1, base, d, harmonics)
}

/// Наибольший общий делитель (НОД)
pub fn gcd(mut a: i64, mut b: i64) -> i64 {
    a = a.abs();
    b = b.abs();
    while b != 0 {
        let t = b;
        b = a % b;
        a = t;
    }
    if a == 0 { 1 } else { a }
}

/// Наименьшее общее кратное (НОК)
pub fn lcm(a: i64, b: i64) -> i64 {
    if a == 0 || b == 0 {
        return 1;
    }
    let g = gcd(a, b);
    (a.abs() / g) * b.abs()
}

/// Вычисление периода гармоник через общий наименьший знаменатель (LCM)
pub fn harmonics_lcm(harmonics: &[LeapHarmonic]) -> i64 {
    let mut period = 1i64;
    for h in harmonics {
        if h.divisor_c > 0 {
            period = lcm(period, h.divisor_c);
        }
    }
    period
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
            return Err(LeapValidationError::HarmonicsStepViolation);
        }
    }
    Ok(())
}


/// Рациональное представление векового дрейфа календаря (чистая целочисленная арифметика i128)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct RationalDrift {
    pub numerator_days: i128,
    pub denominator_years: i128,
}

impl RationalDrift {
    /// Возвращает дрейф в милли-сутках за 100 лет (целочисленный промилле, 1.0 сутки = 1000)
    #[inline]
    pub fn to_milli_days_per_century(&self) -> i64 {
        if self.denominator_years == 0 {
            return 0;
        }
        ((self.numerator_days * 1000) / self.denominator_years) as i64
    }

    /// Преобразует в f64 исключительно для презентационного слоя UI
    #[inline]
    pub fn to_f64(&self) -> f64 {
        if self.denominator_years == 0 {
            0.0
        } else {
            self.numerator_days as f64 / self.denominator_years as f64
        }
    }
}

/// Точный рациональный расчет векового дрейфа (без единого числа с плавающей точкой)
pub fn drift_per_century_rational(
    base: i64,
    harmonics: &[LeapHarmonic],
    trop_num: i64,
    trop_den: i64,
) -> RationalDrift {
    if trop_den == 0 {
        return RationalDrift {
            numerator_days: 0,
            denominator_years: 1,
        };
    }

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

    let cal_year_num = (base as i128) * (q_den as i128) + sum_w_a;
    let cal_year_den = q_den as i128;

    let trop_year_num = trop_num as i128;
    let trop_year_den = trop_den as i128;

    let diff_num = cal_year_num * trop_year_den - trop_year_num * cal_year_den;
    let num_100 = 100i128 * diff_num;
    let den_100 = cal_year_den * trop_year_den;

    RationalDrift {
        numerator_days: num_100,
        denominator_years: den_100,
    }
}

/// Расчет векового дрейфа (в сутках за 100 лет) относительно тропического года планеты
pub fn drift_per_century(
    base: i64,
    harmonics: &[LeapHarmonic],
    trop_num: i64,
    trop_den: i64,
) -> f64 {
    drift_per_century_rational(base, harmonics, trop_num, trop_den).to_f64()
}

/// Расчет векового дрейфа (в сутках за 100 лет) относительно целевой длины года в f64
pub fn drift_per_century_f64(
    base: i64,
    harmonics: &[LeapHarmonic],
    planet_year_len: f64,
) -> f64 {
    let mut leap_fraction = 0.0f64;
    for h in harmonics {
        if h.divisor_c != 0 {
            leap_fraction += (h.weight as f64 * h.multiplier_a as f64) / (h.divisor_c as f64);
        }
    }
    let rule_year_len = base as f64 + leap_fraction;
    100.0 * (rule_year_len - planet_year_len)
}




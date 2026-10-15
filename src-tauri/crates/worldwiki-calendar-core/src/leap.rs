use crate::types::{LeapHarmonic, LeapTarget};

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

/// Дни от начала времен (год 1) до начала года Y (включая год 0 и отрицательные века)
/// Формула вычисляется строго в i128 во избежание переполнения
pub fn days_up_to_year(y: i64, base: i64, d: i64, harmonics: &[LeapHarmonic]) -> i64 {
    let base_days = (y as i128 - 1) * (base as i128);
    let leap_days = (d as i128) * ((leaps_count(y - 1, harmonics) - leaps_count(0, harmonics)) as i128);
    (base_days + leap_days) as i64
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

/// Расчет векового дрейфа (в сутках за 100 лет) относительно тропического года планеты
pub fn drift_per_century(
    base: i64,
    harmonics: &[LeapHarmonic],
    trop_num: i64,
    trop_den: i64,
) -> f64 {
    if trop_den == 0 {
        return 0.0;
    }
    let mut leap_fraction = 0.0f64;
    for h in harmonics {
        if h.divisor_c != 0 {
            leap_fraction += (h.weight as f64 * h.multiplier_a as f64) / (h.divisor_c as f64);
        }
    }
    let rule_year_len = base as f64 + leap_fraction;
    let planet_year_len = trop_num as f64 / trop_den as f64;
    100.0 * (rule_year_len - planet_year_len)
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

/// Приближение високосного цикла через разложение цепной дроби (Карточка 4.9)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct LeapApproximation {
    pub leap_years: i64,
    pub cycle_years: i64,
}

/// Вычисляет список оптимальных приближений цепных дробей для дробной части тропического года
pub fn calculate_leap_convergents(
    trop_num: i64,
    trop_den: i64,
    max_convergents: usize,
) -> alloc::vec::Vec<LeapApproximation> {
    let mut results = alloc::vec::Vec::new();
    if trop_den <= 0 || max_convergents == 0 {
        return results;
    }
    let frac_num = trop_num.rem_euclid(trop_den);
    if frac_num == 0 {
        return results;
    }

    let mut n = trop_den;
    let mut d = frac_num;

    let mut p_prev = 1i64;
    let mut q_prev = 0i64;
    let mut p_curr = 0i64;
    let mut q_curr = 1i64;

    while d != 0 && results.len() < max_convergents {
        let a = n / d;
        let rem = n % d;
        n = d;
        d = rem;

        let p_next = match a.checked_mul(p_curr).and_then(|v| v.checked_add(p_prev)) {
            Some(v) => v,
            None => break,
        };
        let q_next = match a.checked_mul(q_curr).and_then(|v| v.checked_add(q_prev)) {
            Some(v) => v,
            None => break,
        };

        p_prev = p_curr;
        q_prev = q_curr;
        p_curr = p_next;
        q_curr = q_next;

        if p_curr > 0 && q_curr > 0 {
            results.push(LeapApproximation {
                leap_years: p_curr,
                cycle_years: q_curr,
            });
        }
    }
    results
}


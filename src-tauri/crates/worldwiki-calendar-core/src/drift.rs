use crate::types::LeapHarmonic;

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

#[cfg(test)]
mod tests {
    use super::*;
    extern crate alloc;
    use alloc::format;

    #[test]
    fn test_drift_coverage_internal() {
        let rd1 = RationalDrift { numerator_days: 10, denominator_years: 100 };
        let rd2 = RationalDrift { numerator_days: 20, denominator_years: 100 };
        let rd3 = RationalDrift { numerator_days: 10, denominator_years: 200 };
        assert_eq!(rd1.clone(), rd1);
        assert!(rd1 != rd2);
        assert!(rd1 != rd3);
        let _ = format!("{rd1:?}");

        assert_eq!(gcd(0, 0), 1);
        assert_eq!(gcd(12, 18), 6);
        assert_eq!(lcm(0, 5), 1);
        assert_eq!(lcm(5, 0), 1);
        assert_eq!(lcm(12, 18), 36);

        let h_valid = LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 4, weight: 1 };
        let h_zero = LeapHarmonic { multiplier_a: 1, shift_b: 0, divisor_c: 0, weight: 1 };
        assert_eq!(harmonics_lcm(&[]), 1);
        assert_eq!(harmonics_lcm(&[h_valid, h_zero]), 4);

        assert_eq!(RationalDrift { numerator_days: 1, denominator_years: 0 }.to_milli_days_per_century(), 0);
        assert_eq!(rd1.to_milli_days_per_century(), 100);
        assert_eq!(RationalDrift { numerator_days: 1, denominator_years: 0 }.to_f64(), 0.0);
        assert_eq!(rd1.to_f64(), 0.1);

        let r_zero = drift_per_century_rational(365, &[h_valid, h_zero], 365, 0);
        assert_eq!(r_zero.denominator_years, 1);
        let r_val = drift_per_century_rational(365, &[h_valid, h_zero], 36525, 100);
        assert_eq!(r_val.numerator_days, 0);

        assert_eq!(drift_per_century(365, &[], 365, 0), 0.0);
        assert_eq!(drift_per_century(365, &[h_valid], 36525, 100), 0.0);

        assert_eq!(drift_per_century_f64(365, &[h_zero], 365.0), 0.0);
        assert_eq!(drift_per_century_f64(365, &[h_valid], 365.25), 0.0);
    }
}

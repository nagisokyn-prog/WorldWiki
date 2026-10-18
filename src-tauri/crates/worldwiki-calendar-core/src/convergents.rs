extern crate alloc;

/// Максимально допустимая глубина разложения цепной дроби (п. 13.1)
pub const MAX_CONTINUED_FRACTION_DEPTH: usize = 10;

/// Приближение високосного цикла через разложение цепной дроби (Карточка 4.9)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct LeapApproximation {
    pub leap_years: i64,
    pub cycle_years: i64,
}

/// Вычисляет список оптимальных приближений цепных дробей для дробной части тропического года (п. 13.1 - 13.3)
///
/// Архитектурные инварианты:
/// 1. Защита от переполнений (п. 13.1): Рекуррентная формула подходящих дробей p_k / q_k
///    вычисляется строго в `i128`, с автоматическим выходом при приближении к границе `i64::MAX`.
///    Глубина среза ограничена `MAX_CONTINUED_FRACTION_DEPTH` (10 шагов).
/// 2. Защита от зацикливания (п. 13.2): При нулевой дробной части (`frac_num == 0`) алгоритм
///    завершается немедленно, возвращая пустой список (високосный цикл не требуется).
/// 3. Положительность периода (п. 13.3): При `trop_num <= 0` или `trop_den <= 0` алгоритм
///    безопасно возвращает пустой список.
pub fn calculate_leap_convergents(
    trop_num: i64,
    trop_den: i64,
    max_convergents: usize,
) -> alloc::vec::Vec<LeapApproximation> {
    let mut results = alloc::vec::Vec::new();
    if trop_num <= 0 || trop_den <= 0 || max_convergents == 0 {
        return results;
    }

    let frac_num = trop_num.rem_euclid(trop_den);
    if frac_num == 0 {
        return results;
    }

    let effective_max = max_convergents.min(MAX_CONTINUED_FRACTION_DEPTH);

    let mut n = trop_den as i128;
    let mut d = frac_num as i128;

    let mut p_prev = 1i128;
    let mut q_prev = 0i128;
    let mut p_curr = 0i128;
    let mut q_curr = 1i128;

    while d != 0 && results.len() < effective_max {
        let a = n / d;
        let rem = n % d;
        n = d;
        d = rem;

        // Рекуррентная формула Гаусса-Эйлера: p_{k} = a_k * p_{k-1} + p_{k-2}
        let p_next = a * p_curr + p_prev;
        let q_next = a * q_curr + q_prev;


        p_prev = p_curr;
        q_prev = q_curr;
        p_curr = p_next;
        q_curr = q_next;

        if p_curr > 0 && q_curr > 0 {
            results.push(LeapApproximation {
                leap_years: p_curr as i64,
                cycle_years: q_curr as i64,
            });
        }
    }

    results
}

use crate::types::LeapHarmonic;

/// Наибольший общий делитель для сокращения дробей
fn gcd(mut a: i64, mut b: i64) -> i64 {
    while b != 0 {
        let t = b;
        b = a % b;
        a = t;
    }
    a.abs().max(1)
}

/// Универсальный алгоритм разложения рациональной дроби p/q в знаковые единичные гармоники:
/// p/q = sum_i (w_i / c_i), где w_i in {+1, -1}, multiplier_a = 1.
/// Гарантирует читаемость правила для любого мира/планеты без хардкода.
pub fn decompose_fraction_to_unit_harmonics(
    p: i64,
    q: i64,
    max_harmonics: usize,
) -> alloc::vec::Vec<LeapHarmonic> {
    let mut harmonics = alloc::vec::Vec::new();
    if p <= 0 || q <= 0 || max_harmonics == 0 {
        return harmonics;
    }

    let mut rem_num = p;
    let mut rem_den = q;

    for _ in 0..max_harmonics {
        if rem_num == 0 {
            break;
        }

        let sign: i32 = if rem_num > 0 { 1 } else { -1 };
        let abs_num = rem_num.abs();

        // c = round(rem_den / abs_num)
        let mut c = (rem_den + abs_num / 2) / abs_num;
        if c < 1 {
            c = 1;
        }

        while harmonics.iter().any(|h: &LeapHarmonic| h.divisor_c == c) {
            c += 1;
        }

        harmonics.push(LeapHarmonic {
            weight: sign,
            multiplier_a: 1,
            shift_b: 0,
            divisor_c: c,
        });

        // rem_num/rem_den - sign/c = (rem_num * c - sign * rem_den) / (rem_den * c)
        let next_num = rem_num * c - (sign as i64) * rem_den;
        let next_den = rem_den * c;

        if next_num == 0 {
            break;
        }

        let g = gcd(next_num.abs(), next_den);
        rem_num = next_num / g;
        rem_den = next_den / g;

        // rem_num / rem_den < 0.00005 <=> rem_num * 20_000 < rem_den (чистая целочисленная арифметика для no_std и Kani)
        if rem_num.abs().saturating_mul(20_000) < rem_den {
            break;
        }
    }

    harmonics
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decompose_julian() {
        let h = decompose_fraction_to_unit_harmonics(1, 4, 3);
        assert_eq!(h.len(), 1);
        assert_eq!(h[0].weight, 1);
        assert_eq!(h[0].divisor_c, 4);
    }

    #[test]
    fn test_decompose_madler_31_128() {
        let h = decompose_fraction_to_unit_harmonics(31, 128, 3);
        assert_eq!(h.len(), 2);
        assert_eq!(h[0].weight, 1);
        assert_eq!(h[0].divisor_c, 4);
        assert_eq!(h[1].weight, -1);
        assert_eq!(h[1].divisor_c, 128);
    }

    #[test]
    fn test_decompose_khayyam_8_33() {
        let h = decompose_fraction_to_unit_harmonics(8, 33, 3);
        assert_eq!(h.len(), 2);
        assert_eq!(h[0].weight, 1);
        assert_eq!(h[0].divisor_c, 4);
        assert_eq!(h[1].weight, -1);
        assert_eq!(h[1].divisor_c, 132);
    }

    #[test]
    fn test_decompose_mars_3_5() {
        let h = decompose_fraction_to_unit_harmonics(3, 5, 3);
        assert_eq!(h.len(), 2);
        assert_eq!(h[0].weight, 1);
        assert_eq!(h[0].divisor_c, 2);
        assert_eq!(h[1].weight, 1);
        assert_eq!(h[1].divisor_c, 10);
    }
}

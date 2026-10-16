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
        let p_next = match a.checked_mul(p_curr).and_then(|v| v.checked_add(p_prev)) {
            Some(v) => v,
            None => break,
        };
        let q_next = match a.checked_mul(q_curr).and_then(|v| v.checked_add(q_prev)) {
            Some(v) => v,
            None => break,
        };

        if p_next > i64::MAX as i128 || q_next > i64::MAX as i128 {
            break;
        }

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

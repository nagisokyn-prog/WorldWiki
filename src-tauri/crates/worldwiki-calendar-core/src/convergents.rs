extern crate alloc;

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

        let p_next = a * p_curr + p_prev;
        let q_next = a * q_curr + q_prev;



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

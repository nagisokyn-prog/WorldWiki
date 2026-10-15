extern crate alloc;

/// Нормализует культурный индекс месяца во внутренний с учетом первого месяца года
/// (Спецификация раздел 3.7)
#[inline]
pub fn to_internal_month(cultural_m: usize, m_start: usize, total_months: usize) -> usize {
    if total_months == 0 {
        return 0;
    }
    (cultural_m + total_months - (m_start % total_months)) % total_months
}

/// Восстанавливает культурный номер месяца из внутреннего
/// (Спецификация раздел 3.7)
#[inline]
pub fn to_cultural_month(internal_m: usize, m_start: usize, total_months: usize) -> usize {
    if total_months == 0 {
        return 0;
    }
    (internal_m + m_start) % total_months
}

/// Проверяет активность праздника с поддержкой перехода через границу года
/// (Спецификация раздел 3.9)
#[inline]
pub fn is_holiday_active(
    curr_m: usize,
    curr_d: i64,
    start_m: usize,
    start_d: i64,
    end_m: usize,
    end_d: i64,
) -> bool {
    let curr = (curr_m, curr_d);
    let start = (start_m, start_d);
    let end = (end_m, end_d);

    if start <= end {
        // Обычный праздник внутри одного года (например, 1 мая - 9 мая)
        curr >= start && curr <= end
    } else {
        // Праздник с переходом через границу Нового Года (например, 28 декабря - 3 января)
        curr >= start || curr <= end
    }
}

extern crate alloc;

/// Нормализует культурный индекс месяца во внутренний с учетом первого месяца года
/// (Спецификация раздел 3.7). Эпагомены (индекс >= total_months) не ротируются.
#[inline]
pub fn to_internal_month(cultural_m: usize, m_start: usize, total_months: usize) -> usize {
    if total_months == 0 {
        return 0;
    }
    if cultural_m >= total_months {
        return cultural_m;
    }
    (cultural_m + total_months - (m_start % total_months)) % total_months
}

/// Восстанавливает культурный номер месяца из внутреннего
/// (Спецификация раздел 3.7). Эпагомены (индекс >= total_months) не ротируются.
#[inline]
pub fn to_cultural_month(internal_m: usize, m_start: usize, total_months: usize) -> usize {
    if total_months == 0 {
        return 0;
    }
    if internal_m >= total_months {
        return internal_m;
    }
    (internal_m + m_start) % total_months
}

/// Праздник с поддержкой многолетней длительности (например, "Год Тигра", траур, юбилеи)
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CoreHoliday {
    pub name: alloc::string::String,
    pub start_month: usize,
    pub start_day: i64,
    pub end_month: usize,
    pub end_day: i64,
    pub start_year: Option<i64>,
    pub duration_years: u32,
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
        // Обычный праздник внутри одного года (например, 1 мая - 9 мая или внутри эпагоменов)
        curr >= start && curr <= end
    } else {
        // Праздник с переходом через границу Нового Года (например, 28 декабря - 3 января)
        curr >= start || curr <= end
    }
}

/// Проверка активности праздника с учетом года и многолетней длительности
#[inline]
pub fn is_multi_year_holiday_active(
    curr_y: i64,
    curr_m: usize,
    curr_d: i64,
    holiday: &CoreHoliday,
) -> bool {
    if let Some(start_y) = holiday.start_year {
        let end_y = start_y + holiday.duration_years as i64;
        if curr_y < start_y || curr_y > end_y {
            return false;
        }
        if curr_y == start_y && (curr_m, curr_d) < (holiday.start_month, holiday.start_day) {
            return false;
        }
        if curr_y == end_y && (curr_m, curr_d) > (holiday.end_month, holiday.end_day) {
            return false;
        }
        true
    } else {
        // Ежегодный циклический праздник
        is_holiday_active(
            curr_m,
            curr_d,
            holiday.start_month,
            holiday.start_day,
            holiday.end_month,
            holiday.end_day,
        )
    }
}

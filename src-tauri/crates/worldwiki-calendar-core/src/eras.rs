extern crate alloc;
use crate::types::{CoreEra, EraCountingMode};

/// Сравнивает две даты (год, месяц, день) лексикографически
#[inline]
pub fn compare_dates(
    y1: i64,
    m1: usize,
    d1: i64,
    y2: i64,
    m2: usize,
    d2: i64,
) -> core::cmp::Ordering {
    y1.cmp(&y2)
        .then_with(|| m1.cmp(&m2))
        .then_with(|| d1.cmp(&d2))
}

/// Проверяет, попадает ли заданная дата в рамки эры
pub fn era_contains_date(era: &CoreEra, year: i64, month: usize, day: i64) -> bool {
    let start_m = era.start_month.unwrap_or(1);
    let start_d = era.start_day.unwrap_or(1);

    // Дата должна быть не раньше начала эры
    if compare_dates(year, month, day, era.start_year, start_m, start_d).is_lt() {
        return false;
    }

    // Если дата окончания задана, дата должна быть строго до или включительно (до конца)
    if let Some(end_year) = era.end_year {
        let end_m = era.end_month.unwrap_or(12);
        let end_d = era.end_day.unwrap_or(31);
        if compare_dates(year, month, day, end_year, end_m, end_d).is_gt() {
            return false;
        }
    }

    true
}

/// Бинарный поиск активной эры в отсортированном по дате начала срезе эр
pub fn find_active_era(
    sorted_eras: &[CoreEra],
    year: i64,
    month: usize,
    day: i64,
) -> Option<&CoreEra> {
    if sorted_eras.is_empty() {
        return None;
    }

    // Ищем первую эру, чье начало > искомой даты
    let idx = sorted_eras.partition_point(|e| {
        let sm = e.start_month.unwrap_or(1);
        let sd = e.start_day.unwrap_or(1);
        compare_dates(e.start_year, sm, sd, year, month, day).is_le()
    });

    if idx == 0 {
        return None;
    }

    let candidate = &sorted_eras[idx - 1];
    if era_contains_date(candidate, year, month, day) {
        Some(candidate)
    } else {
        None
    }
}

/// Вычисляет порядковый номер года внутри эры (например, 1-й год правления)
pub fn era_year_number(
    era: &CoreEra,
    year: i64,
    month: usize,
    day: i64,
    max_days_in_target_month: i64,
) -> i64 {
    match era.counting_mode {
        EraCountingMode::ByCalendarYear => {
            if era.is_count_down {
                era.start_year - year + 1
            } else {
                year - era.start_year + 1
            }
        }
        EraCountingMode::ByAnniversary => {
            let start_m = era.start_month.unwrap_or(1);
            let raw_start_d = era.start_day.unwrap_or(1);
            // Защита от высокосного дня (например, коронация 29 февраля в невисокосный год)
            let start_d = raw_start_d.min(max_days_in_target_month);

            let passed_anniversary = compare_dates(0, month, day, 0, start_m, start_d).is_ge();

            if era.is_count_down {
                let years_diff = era.start_year - year;
                if passed_anniversary {
                    years_diff + 1
                } else {
                    years_diff
                }
            } else {
                let years_diff = year - era.start_year;
                if passed_anniversary {
                    years_diff + 1
                } else {
                    years_diff
                }
            }
        }
    }
}

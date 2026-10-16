extern crate alloc;
use crate::types::{CoreEra, EraCountingMode};

/// Ошибки валидации хронологических эр
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EraValidationError {
    /// Обратный отсчет (Countdown) требует обязательного указания года окончания (end_year)
    CountdownMissingEndYear,
    /// Нетерминальная (промежуточная) эра обязана иметь явный end_year
    OpenNonTerminalEra,
    /// Дата окончания эры предшествует дате начала
    EndBeforeStart,
    /// Некорректный номер месяца (0 или вне допустимого диапазона)
    InvalidMonth,
    /// Некорректный день месяца (меньше или равен 0)
    InvalidDay,
}

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

/// Валидирует отдельную эру в соответствии с хронологическими инвариантами
pub fn validate_era(era: &CoreEra, is_terminal: bool) -> Result<(), EraValidationError> {
    // 8.4: Countdown с end_year = None недопустим
    if era.is_count_down && era.end_year.is_none() {
        return Err(EraValidationError::CountdownMissingEndYear);
    }

    // 8.3: Нетерминальная эра обязана иметь end_year
    if !is_terminal && era.end_year.is_none() {
        return Err(EraValidationError::OpenNonTerminalEra);
    }

    if era.start_month.is_some_and(|m| m == 0) || era.end_month.is_some_and(|m| m == 0) {
        return Err(EraValidationError::InvalidMonth);
    }

    if era.start_day.is_some_and(|d| d <= 0) || era.end_day.is_some_and(|d| d <= 0) {
        return Err(EraValidationError::InvalidDay);
    }

    if let Some(end_y) = era.end_year {
        let start_m = era.start_month.unwrap_or(1);
        let start_d = era.start_day.unwrap_or(1);
        let end_m = era.end_month.unwrap_or(12);
        let end_d = era.end_day.unwrap_or(31);

        if compare_dates(era.start_year, start_m, start_d, end_y, end_m, end_d).is_gt() {
            return Err(EraValidationError::EndBeforeStart);
        }
    }

    Ok(())
}

/// Валидирует срез хронологических эр
pub fn validate_eras_slice(eras: &[CoreEra]) -> Result<(), EraValidationError> {
    let len = eras.len();
    for (idx, era) in eras.iter().enumerate() {
        let is_terminal = idx + 1 == len;
        validate_era(era, is_terminal)?;
    }
    Ok(())
}

/// Сортирует срез эр: по возрастанию даты начала, а при совпадении — по убыванию приоритета
pub fn sort_eras(eras: &mut [CoreEra]) {
    eras.sort_by(|a, b| {
        let sm_a = a.start_month.unwrap_or(1);
        let sd_a = a.start_day.unwrap_or(1);
        let sm_b = b.start_month.unwrap_or(1);
        let sd_b = b.start_day.unwrap_or(1);

        compare_dates(a.start_year, sm_a, sd_a, b.start_year, sm_b, sd_b)
            .then_with(|| b.priority.cmp(&a.priority))
    });
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

/// Поиск активной эры для заданной даты
///
/// Семантика поведения:
/// 1. Пересекающиеся эры (п. 8.1): Если дату покрывают несколько эр, побеждает эра с наивысшим
///    `priority`. При равном `priority` побеждает эра с более поздней датой начала.
/// 2. Разрывы между эрами (п. 8.2): Если дата попадает в хронологический разрыв между закрытой
///    эрой и началом следующей (ни одна эра не покрывает дату), функция строго возвращает `None`.
pub fn find_active_era(
    sorted_eras: &[CoreEra],
    year: i64,
    month: usize,
    day: i64,
) -> Option<&CoreEra> {
    if sorted_eras.is_empty() {
        return None;
    }

    // Выбираем среди подходящих эр ту, у которой наивысший приоритет
    sorted_eras
        .iter()
        .filter(|e| era_contains_date(e, year, month, day))
        .max_by(|a, b| {
            a.priority
                .cmp(&b.priority)
                .then_with(|| {
                    let sm_a = a.start_month.unwrap_or(1);
                    let sd_a = a.start_day.unwrap_or(1);
                    let sm_b = b.start_month.unwrap_or(1);
                    let sd_b = b.start_day.unwrap_or(1);
                    compare_dates(a.start_year, sm_a, sd_a, b.start_year, sm_b, sd_b)
                })
        })
}

/// Вычисляет порядковый номер года внутри эры (например, 1-й год правления)
///
/// Хронологические инварианты (п. 8.5):
/// - Традиционная регнальная система: 1-based indexing (нет нулевого года правления).
/// - Если `year == era.start_year`, возвращается `1`.
/// - Для года 0: при `start_year = 0` и `year = 0`, возвращается `0 - 0 + 1 = 1`.
/// - Для отрицательных лет (до н.э.): при `start_year = -5` и `year = -5`, возвращается `-5 - (-5) + 1 = 1`.
/// - При обратном отсчете (`is_count_down = true`): если `target_year = end_year`, то в последний год эры номер равен 1.
///
/// Обработка годовщин (п. 8.6):
/// - При `EraCountingMode::ByAnniversary` день коронации/годовщины зажимается через
///   `raw_start_d.min(max_days_in_target_month)`. Если годовщина выпадает на несуществующий день
///   (например, 29 февраля в невисокосный год или 31 апреля в 30-дневный месяц), она празднуется
///   в последний действительный день соответствующего месяца.
pub fn era_year_number(
    era: &CoreEra,
    year: i64,
    month: usize,
    day: i64,
    max_days_in_target_month: i64,
) -> i64 {
    match era.counting_mode {
        EraCountingMode::ByCalendarYear | EraCountingMode::Unknown => {
            if era.is_count_down {
                let target_year = era.end_year.unwrap_or(era.start_year);
                target_year - year + 1
            } else {
                year - era.start_year + 1
            }
        }
        EraCountingMode::ByAnniversary => {
            let start_m = era.start_month.unwrap_or(1);
            let raw_start_d = era.start_day.unwrap_or(1);
            // Защита от несуществующих дней в целевом месяце (29 февраля, 31 апреля и т.д.)
            let clamped_start_d = raw_start_d.min(max_days_in_target_month);

            let passed_anniversary = if month > start_m {
                true
            } else if month < start_m {
                false
            } else {
                day >= clamped_start_d
            };

            if era.is_count_down {
                let target_year = era.end_year.unwrap_or(era.start_year);
                let years_diff = target_year - year;
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

extern crate alloc;
use crate::eras::compare_dates;
use crate::types::{AgeRule, CalDate};

/// Вычисляет возраст персонажа с учетом параметров культуры:
/// - age_at_birth: возраст при рождении (0 в европейской традиции, 1 в традиционной восточноазиатской)
/// - step_on_new_year: прибавление возраста строго в день Нового Года
/// - year_only: приближенный расчет только по разнице годов
pub fn calculate_age(
    birth: CalDate,
    current: CalDate,
    rule: &AgeRule,
    max_days_in_birth_month: i64,
) -> i32 {
    let cmp = compare_dates(
        current.year,
        current.month,
        current.day,
        birth.year,
        birth.month,
        birth.day,
    );

    // До момента рождения
    if cmp.is_lt() {
        let diff = (current.year - birth.year) as i32;
        return rule.age_at_birth + diff - 1;
    }

    let years_diff = (current.year - birth.year) as i32;

    if rule.step_on_new_year || rule.year_only {
        return rule.age_at_birth + years_diff;
    }

    // Классический расчет по дню рождения
    let effective_birth_day = if max_days_in_birth_month > 0 {
        birth.day.min(max_days_in_birth_month)
    } else {
        birth.day
    };

    let had_birthday = compare_dates(
        0,
        current.month,
        current.day,
        0,
        birth.month,
        effective_birth_day,
    )
    .is_ge();

    if had_birthday {
        rule.age_at_birth + years_diff
    } else {
        rule.age_at_birth + years_diff - 1
    }
}

extern crate alloc;
use crate::eras::compare_dates;
use crate::types::{AgeRule, CalDate};

/// Вычисляет возраст персонажа в соответствии с правилами календаря культуры (п. 10.1 - 10.6)
///
/// Семантика параметров `rule`:
/// - `age_at_birth`: возраст при рождении (0 в европейской традиции, 1 в традиционной восточноазиатской)
/// - `step_on_new_year`: прибавление возраста строго 1-го числа Нового Года
/// - `year_only`: расчет по разнице календарных годов без учета дней и месяцев
///
/// Архитектурные инварианты (п. 10):
/// 1. Отрицательный возраст (п. 10.4): Если `current < birth` (дата предшествует моменту рождения),
///    функция возвращает отрицательный возраст без паники (например, -1 за несколько месяцев до рождения).
/// 2. Восточноазиатский счет (п. 10.5): При `age_at_birth = 1` и `step_on_new_year = true`, если рождение
///    произошло 1 января, то и 1, и 2 января того же года возраст равен 1, а 1 января следующего года — 2.
/// 3. Эквивалентность `year_only` и `step_on_new_year` (п. 10.6): Обе настройки вычисляют возраст строго
///    как `rule.age_at_birth + years_diff`.
/// 4. Коррекция дней и месяцев (п. 10.1 - 10.3): Невалидные дни (`day <= 0`) зажимаются в `.max(1)`.
///    Для коротких или вставных месяцев день рождения зажимается через `max_days_in_birth_month`.
pub fn calculate_age(
    birth: CalDate,
    current: CalDate,
    rule: &AgeRule,
    max_days_in_birth_month: i64,
) -> i32 {
    let safe_birth_day = birth.day.max(1);
    let safe_current_day = current.day.max(1);

    let cmp = compare_dates(
        current.year,
        current.month,
        safe_current_day,
        birth.year,
        birth.month,
        safe_birth_day,
    );

    // До момента рождения: отрицательный возраст
    if cmp.is_lt() {
        let diff = (current.year - birth.year) as i32;
        return rule.age_at_birth + diff - 1;
    }

    let years_diff = (current.year - birth.year) as i32;

    // Расчет по календарному году (Новый Год или приближенный годовой расчет)
    if rule.step_on_new_year || rule.year_only {
        return rule.age_at_birth + years_diff;
    }

    // Классический расчет по годовщине дня рождения
    let (target_month, effective_birth_day) = if max_days_in_birth_month > 0 {
        (birth.month, safe_birth_day.min(max_days_in_birth_month))
    } else {
        // Если в текущем году месяц рождения отсутствует (max_days = 0, например високосный месяц):
        // переносим празднование на предшествующий месяц, если birth.month > 1
        let shifted_month = if birth.month > 1 { birth.month - 1 } else { 1 };
        (shifted_month, safe_birth_day)
    };

    let had_birthday = compare_dates(
        0,
        current.month,
        safe_current_day,
        0,
        target_month,
        effective_birth_day,
    )
    .is_ge();

    if had_birthday {
        rule.age_at_birth + years_diff
    } else {
        rule.age_at_birth + years_diff - 1
    }
}

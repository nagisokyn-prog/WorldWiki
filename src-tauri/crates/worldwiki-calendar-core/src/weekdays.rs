extern crate alloc;
use crate::leap::{days_up_to_year, leaps_count};
use crate::types::LeapHarmonic;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WeekdayError {
    EmptyWeekdays,
}

/// Валидация списка дней недели (защита от деления на 0 при rem_euclid)
#[inline]
pub fn validate_weekdays_count(count: usize) -> Result<(), WeekdayError> {
    if count == 0 {
        Err(WeekdayError::EmptyWeekdays)
    } else {
        Ok(())
    }
}

/// Непрерывный расчет дня недели с возвратом ошибки при пустом списке дней недели
#[inline]
pub fn try_calculate_weekday(
    cal_day: i64,
    origin_day: i64,
    start_weekday: usize,
    weekdays_count: usize,
) -> Result<usize, WeekdayError> {
    if weekdays_count == 0 {
        return Err(WeekdayError::EmptyWeekdays);
    }
    let d_local = cal_day - origin_day;
    Ok((d_local + start_weekday as i64).rem_euclid(weekdays_count as i64) as usize)
}

/// Непрерывный расчет дня недели (без пауз, безопасный дефолт 0 при count == 0)
pub fn calculate_weekday(
    cal_day: i64,
    origin_day: i64,
    start_weekday: usize,
    weekdays_count: usize,
) -> usize {
    try_calculate_weekday(cal_day, origin_day, start_weekday, weekdays_count).unwrap_or(0)
}

/// Конфигурация расчета недели с приостановкой на дни вне месяцев.
///
/// ВАЖНО (Архитектурный инвариант):
/// Пауза недели распространяется СТРОГО на интеркалярные дни вне сетки месяцев (эпагомены,
/// санкюлотиды, Ayyam-i-Ha). Обычные внутримесячные праздники (Новый Год, Масленица, Рождество)
/// НЕ замораживают течение недели; они моделируются независимо через модуль `holidays.rs`
/// и наступают в текущий день недели по непрерывному календарному циклу.
#[derive(Debug, Clone, Copy)]
pub struct WeekdayPauseConfig<'a> {
    pub days_in_regular_months: i64,
    pub extra_days_base: i64,
    pub extra_days_leap: i64,
    pub harmonics: &'a [LeapHarmonic],
    pub origin_year: i64,
    pub origin_day: i64,
    pub start_weekday: usize,
    pub weekdays_count: usize,
}

/// Расчет дня недели с приостановкой на дни вне месяцев (спецификация раздел 3.6, случай 2).
///
/// Семантика заморозки:
/// 1. Все дополнительные дни вне месяцев (эпагомены) исключаются из счета дней недели и возвращают `None`.
/// 2. Количество эпагоменов может быть любым (даже больше длины недели, например 10 эпагоменов при 5-дневной неделе).
/// 3. После завершения блока эпагоменов счет недели возобновляется СТРОГО со следующего дня недели (без разрывов).
pub fn calculate_weekday_with_pause(
    year: i64,
    day_in_year: i64,
    config: &WeekdayPauseConfig,
) -> Option<usize> {
    if config.weekdays_count == 0 {
        return Some(0);
    }
    // Если день попадает в праздничный блок текущего года
    if day_in_year >= config.days_in_regular_months {
        return None;
    }

    let f_curr = leaps_count(year - 1, config.harmonics) - leaps_count(0, config.harmonics);
    let holidays_before = (year - 1) * config.extra_days_base + f_curr * config.extra_days_leap;

    let f_orig = leaps_count(config.origin_year - 1, config.harmonics)
        - leaps_count(0, config.harmonics);
    let holidays_orig = (config.origin_year - 1) * config.extra_days_base
        + f_orig * config.extra_days_leap;

    let cal_day = days_up_to_year(
        year,
        config.days_in_regular_months + config.extra_days_base,
        config.extra_days_leap,
        config.harmonics,
    ) + day_in_year;

    let eff_cal = cal_day - holidays_before;
    let eff_orig = config.origin_day - holidays_orig;
    let d_eff_netto = eff_cal - eff_orig;

    let idx = (d_eff_netto + config.start_weekday as i64).rem_euclid(config.weekdays_count as i64);
    Some(idx as usize)
}

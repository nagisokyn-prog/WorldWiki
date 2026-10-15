extern crate alloc;
use crate::leap::{days_up_to_year, leaps_count};
use crate::types::LeapHarmonic;

/// Непрерывный расчет дня недели (без пауз)
pub fn calculate_weekday(
    cal_day: i64,
    origin_day: i64,
    start_weekday: usize,
    weekdays_count: usize,
) -> usize {
    if weekdays_count == 0 {
        return 0;
    }
    let d_local = cal_day - origin_day;
    (d_local + start_weekday as i64).rem_euclid(weekdays_count as i64) as usize
}

/// Конфигурация расчета недели с приостановкой
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

/// Расчет дня недели с приостановкой на дни вне месяцев (спецификация раздел 3.6, случай 2)
/// Возвращает None, если день попадает в праздничный блок года (празднество вне недели)
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

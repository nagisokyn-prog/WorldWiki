extern crate alloc;
use crate::dial::{day_tick_to_units, units_to_day_tick};
use crate::eras::{era_year_number, find_active_era};
use crate::leap::{days_in_month, days_up_to_month, days_up_to_year};
use crate::scalar::{local_moment_to_t_abs, t_abs_to_local_moment};
use crate::types::{CoreEra, DateCoordinate, DialHierarchy, LeapHarmonic, LeapTarget, LocalMoment};
use crate::year_finder::year_from_days_o1;

/// Конфигурация культуры для вычисления календарных преобразований
#[derive(Debug, Clone)]
pub struct CalendarCultureConfig<'a> {
    pub planet_id: &'a str,
    pub ticks_per_day: i64,
    pub day_start_offset: i64,
    pub base_year_days: i64,
    pub regular_months: &'a [i32],
    pub harmonics: &'a [LeapHarmonic],
    pub leap_target: LeapTarget,
    pub leap_day_offset: i64,
    pub calendar_origin_day: i64,
    pub dial: &'a DialHierarchy,
    pub eras: &'a [CoreEra],
}

/// Преобразует календарную дату культуры в абсолютное галактическое время t_abs
pub fn date_to_t_abs(date: &DateCoordinate, config: &CalendarCultureConfig) -> i64 {
    let era = config.eras.get(date.era_index);
    let is_reverse = era.map(|e| e.is_count_down).unwrap_or(false);
    let start_year = era.map(|e| e.start_year).unwrap_or(1);

    let actual_year = if is_reverse {
        start_year - date.year + 1
    } else {
        start_year + date.year - 1
    };

    let days_before_year = days_up_to_year(
        actual_year,
        config.base_year_days,
        config.leap_day_offset,
        config.harmonics,
    );

    let days_in_prev_months = days_up_to_month(
        actual_year,
        date.month,
        config.regular_months,
        &config.leap_target,
        config.leap_day_offset,
        config.harmonics,
    );

    let world_day = days_before_year
        + days_in_prev_months
        + (date.day - 1)
        + config.calendar_origin_day;

    let day_tick = units_to_day_tick(&date.unit_values, config.dial, config.ticks_per_day);

    let moment = LocalMoment {
        planet_id: alloc::string::String::from(config.planet_id),
        world_day,
        day_tick,
    };

    local_moment_to_t_abs(&moment, config.ticks_per_day, config.day_start_offset)
}

/// Преобразует абсолютное галактическое время t_abs в дату культуры
pub fn t_abs_to_date(t_abs: i64, config: &CalendarCultureConfig) -> DateCoordinate {
    let moment = t_abs_to_local_moment(
        t_abs,
        config.planet_id,
        config.ticks_per_day,
        config.day_start_offset,
    );

    let cal_day = moment.world_day - config.calendar_origin_day;

    let (actual_year, day_in_year) = year_from_days_o1(
        cal_day,
        config.base_year_days,
        config.harmonics,
        config.leap_day_offset,
    );

    let mut rem_days = day_in_year;
    let mut month = 0usize;
    let total_months = config.regular_months.len();

    if total_months > 0 {
        for m in 0..total_months {
            let m_days = days_in_month(
                actual_year,
                m,
                config.regular_months,
                &config.leap_target,
                config.leap_day_offset,
                config.harmonics,
            );
            if rem_days < m_days {
                month = m;
                break;
            }
            rem_days -= m_days;
            if m == total_months - 1 {
                month = m;
            }
        }
    }

    let day = rem_days + 1;
    let unit_values = day_tick_to_units(moment.day_tick, config.dial, config.ticks_per_day);

    let mut era_index = 0usize;
    let mut year = actual_year;

    if let Some(active_era) = find_active_era(config.eras, actual_year, month + 1, day) {
        if let Some(pos) = config.eras.iter().position(|e| e.name == active_era.name) {
            era_index = pos;
        }
        let max_days_in_target = days_in_month(
            actual_year,
            month,
            config.regular_months,
            &config.leap_target,
            config.leap_day_offset,
            config.harmonics,
        );
        year = era_year_number(active_era, actual_year, month + 1, day, max_days_in_target);
    }

    DateCoordinate {
        era_index,
        year,
        month,
        day,
        unit_values,
    }
}

/// Межпланетное и межкультурное преобразование даты из календаря А в календарь Б
pub fn convert_calendar_date(
    source_date: &DateCoordinate,
    source_config: &CalendarCultureConfig,
    target_config: &CalendarCultureConfig,
) -> DateCoordinate {
    let t_abs = date_to_t_abs(source_date, source_config);
    t_abs_to_date(t_abs, target_config)
}

/// Вычисляет anchor_world_day для сопряжения связного календаря культуры с мастер-календарем (Карточка 4.1)
pub fn calculate_linked_anchor_world_day(
    master_date: &DateCoordinate,
    master_config: &CalendarCultureConfig,
    local_date: &DateCoordinate,
    local_config: &CalendarCultureConfig,
) -> i64 {
    let t_abs_master = date_to_t_abs(master_date, master_config);
    let master_moment = t_abs_to_local_moment(
        t_abs_master,
        master_config.planet_id,
        master_config.ticks_per_day,
        master_config.day_start_offset,
    );

    let era = local_config.eras.get(local_date.era_index);
    let is_reverse = era.map(|e| e.is_count_down).unwrap_or(false);
    let start_year = era.map(|e| e.start_year).unwrap_or(1);
    let actual_year = if is_reverse {
        start_year - local_date.year + 1
    } else {
        start_year + local_date.year - 1
    };

    let days_before_year = days_up_to_year(
        actual_year,
        local_config.base_year_days,
        local_config.leap_day_offset,
        local_config.harmonics,
    );
    let days_in_prev_months = days_up_to_month(
        actual_year,
        local_date.month,
        local_config.regular_months,
        &local_config.leap_target,
        local_config.leap_day_offset,
        local_config.harmonics,
    );
    let d_local = days_before_year + days_in_prev_months + (local_date.day - 1);

    master_moment.world_day - d_local
}


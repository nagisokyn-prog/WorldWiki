extern crate alloc;
use crate::dial::{day_tick_to_units, units_to_day_tick};
use crate::eras::{era_year_number, find_active_era, EraValidationError};
use crate::leap::{days_in_month, days_up_to_month, days_up_to_year, LeapValidationError};
use crate::scalar::{local_moment_to_t_abs, t_abs_to_local_moment};
use crate::types::{CoreEra, DateCoordinate, DialHierarchy, LeapHarmonic, LeapTarget, LocalMoment};
use crate::year_finder::year_from_days_o1;
pub use crate::sync::*;

/// Режим пересчета при изменении ключевых параметров календаря (п. 15.2)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub enum CalendarMutationMode {
    /// Линза: абсолютное время t_abs сцен неизменно, даты пересчитываются под новую сетку
    #[default]
    LensPreserveAbsoluteTime,
    /// Исправление: номинальные даты (год, месяц, день) сцен сохраняются, t_abs пересчитывается
    FixPreserveNominalDates,
}

/// Локальное гражданское время с учетом планетарного часового пояса (п. 15.4)
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct LocalDateTime {
    pub calendar_id: alloc::string::String,
    pub timezone_offset_ticks: i64,
    pub date: DateCoordinate,
}

/// Ошибки валидации целостной конфигурации календаря (п. 15.1)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CalendarConfigValidationError {
    NonPositiveTicksPerDay,
    DialTicksExceedsTicksPerDay,
    EmptyMonths,
    LeapError(LeapValidationError),
    EraError(EraValidationError),
}

/// Ошибки кросс-календарного преобразования и синхронизации
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConversionError {
    /// Мастер-календарь не найден в реестре (п. 11.2)
    MasterCalendarNotFound,
    /// Обнаружена циклическая зависимость привязки календарей (п. 11.4)
    CyclicSyncDependency,
    /// Превышена максимальная глубина цепочки связывания календарей (п. 11.4)
    MaxChainDepthExceeded,
    /// Дата источника содержит некорректный месяц или день (п. 11.5)
    InvalidSourceDate,
    /// Дата цели содержит некорректный месяц или день
    InvalidTargetDate,
    /// Номер дня выходит за границы месяца
    DayOutOfBounds,
    /// Номер месяца выходит за границы календаря
    MonthOutOfBounds,
}

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

/// Единая валидация целостности конфигурации календаря (п. 15.1)
pub fn validate_calendar_config(
    config: &CalendarCultureConfig,
) -> Result<(), CalendarConfigValidationError> {
    if config.ticks_per_day <= 0 {
        return Err(CalendarConfigValidationError::NonPositiveTicksPerDay);
    }

    let dial_capacity = match crate::dial::checked_total_dial_subdivisions(config.dial) {
        Ok(cap) => cap,
        Err(_) => return Err(CalendarConfigValidationError::DialTicksExceedsTicksPerDay),
    };

    if dial_capacity > config.ticks_per_day {
        return Err(CalendarConfigValidationError::DialTicksExceedsTicksPerDay);
    }

    if config.regular_months.is_empty() {
        return Err(CalendarConfigValidationError::EmptyMonths);
    }

    crate::leap::validate_harmonics_divisors(config.harmonics)
        .map_err(CalendarConfigValidationError::LeapError)?;

    crate::leap::validate_harmonics_step(config.harmonics)
        .map_err(CalendarConfigValidationError::LeapError)?;

    crate::eras::validate_eras_slice(config.eras)
        .map_err(CalendarConfigValidationError::EraError)?;

    Ok(())
}

/// Проверяет валидность календарной координаты относительно конфигурации календаря (п. 11.5)
pub fn validate_date_coordinate(
    date: &DateCoordinate,
    config: &CalendarCultureConfig,
) -> Result<(), ConversionError> {
    let total_months = config.regular_months.len();
    if total_months == 0 {
        return Err(ConversionError::MonthOutOfBounds);
    }

    if date.month >= total_months {
        return Err(ConversionError::MonthOutOfBounds);
    }

    let era = config.eras.get(date.era_index);
    let is_reverse = era.map(|e| e.is_count_down).unwrap_or(false);
    let start_year = era.map(|e| e.start_year).unwrap_or(1);
    let actual_year = if is_reverse {
        start_year - date.year + 1
    } else {
        start_year + date.year - 1
    };

    let max_days = days_in_month(
        actual_year,
        date.month,
        config.regular_months,
        &config.leap_target,
        config.leap_day_offset,
        config.harmonics,
    );

    if date.day < 1 || date.day > max_days {
        return Err(ConversionError::DayOutOfBounds);
    }

    Ok(())
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

/// Межпланетное и межкультурное преобразование даты из календаря А в календарь Б (п. 11.3)
pub fn convert_calendar_date(
    source_date: &DateCoordinate,
    source_config: &CalendarCultureConfig,
    target_config: &CalendarCultureConfig,
) -> DateCoordinate {
    let t_abs = date_to_t_abs(source_date, source_config);
    t_abs_to_date(t_abs, target_config)
}

/// Безопасное межпланетное преобразование с валидацией входной даты (п. 11.5)
pub fn try_convert_calendar_date(
    source_date: &DateCoordinate,
    source_config: &CalendarCultureConfig,
    target_config: &CalendarCultureConfig,
) -> Result<DateCoordinate, ConversionError> {
    validate_date_coordinate(source_date, source_config)?;
    Ok(convert_calendar_date(source_date, source_config, target_config))
}

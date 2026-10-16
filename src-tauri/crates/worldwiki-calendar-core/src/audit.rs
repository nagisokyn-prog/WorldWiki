extern crate alloc;
use alloc::format;
use alloc::string::String;
use alloc::vec::Vec;
use crate::conversion::{validate_calendar_config, CalendarCultureConfig};
use crate::holidays::to_internal_month;
use crate::leap::{days_in_month, days_in_year, drift_per_century_rational, harmonics_lcm, is_leap_year};

/// Предпросмотр одного месяца в таблице года (п. 19.2)
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct MonthPreview {
    pub cultural_month_index: usize,
    pub internal_month_index: usize,
    pub days_count: i64,
}

/// Предпросмотр целого года на лету (п. 19.2)
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct YearPreview {
    pub year: i64,
    pub total_days: i64,
    pub is_leap: bool,
    pub months: Vec<MonthPreview>,
}

/// Генерирует структуру года для интерактивного предпросмотра в UI (п. 19.2)
pub fn generate_year_preview(
    year: i64,
    config: &CalendarCultureConfig,
    first_month_of_year: usize,
) -> YearPreview {
    let total_months = config.regular_months.len();
    let mut months = Vec::with_capacity(total_months);

    for cult_m in 0..total_months {
        let internal_m = to_internal_month(cult_m, first_month_of_year, total_months);
        let days = days_in_month(
            year,
            internal_m,
            config.regular_months,
            &config.leap_target,
            config.leap_day_offset,
            config.harmonics,
        );
        months.push(MonthPreview {
            cultural_month_index: cult_m,
            internal_month_index: internal_m,
            days_count: days,
        });
    }

    let is_leap = is_leap_year(year, config.harmonics) != 0;
    let total_days = days_in_year(
        year,
        config.base_year_days,
        config.leap_day_offset,
        config.harmonics,
    );

    YearPreview {
        year,
        total_days,
        is_leap,
        months,
    }
}

/// Результат диагностики календаря по одному клику: «Проверить мой календарь» (п. 19.3)
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct CalendarAuditReport {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub drift_milli_days_per_century: i64,
    pub harmonics_cycle_years: i64,
}

/// Единый аудит календаря для кнопки «Проверить мой календарь» (п. 19.1 - 19.3)
pub fn audit_calendar_culture(
    config: &CalendarCultureConfig,
    tropical_year_num: i64,
    tropical_year_den: i64,
) -> CalendarAuditReport {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // 1. Валидация базовых инвариантов
    if let Err(err) = validate_calendar_config(config) {
        match err {
            crate::conversion::CalendarConfigValidationError::NonPositiveTicksPerDay => {
                errors.push(String::from("Сутки планеты должны содержать строго больше 0 тиков"));
            }
            crate::conversion::CalendarConfigValidationError::DialTicksExceedsTicksPerDay => {
                errors.push(String::from("Разбиение циферблата превышает общее число тиков в сутках"));
            }
            crate::conversion::CalendarConfigValidationError::EmptyMonths => {
                errors.push(String::from("Календарь обязан содержать как минимум один месяц"));
            }
            crate::conversion::CalendarConfigValidationError::LeapError(l_err) => match l_err {
                crate::leap::LeapValidationError::HarmonicsStepViolation { year, actual_step } => {
                    errors.push(format!(
                        "Гармоники создают некорректный високосный шаг {actual_step} дн. в году {year} (допустимо только 0 или 1)"
                    ));
                }
                crate::leap::LeapValidationError::DuplicateHarmonicDivisor { divisor } => {
                    errors.push(format!("Обнаружен дубликат делителя гармоники: /{divisor}"));
                }
                crate::leap::LeapValidationError::LcmExceedsLimit { lcm, limit } => {
                    errors.push(format!(
                        "Период гармоник {lcm} лет превышает вычислительный лимит {limit} лет"
                    ));
                }
                crate::leap::LeapValidationError::NonPositiveDivisor => {
                    errors.push(String::from("Делитель високосной гармоники обязан быть строго больше 0"));
                }
                crate::leap::LeapValidationError::NegativeLeapDays => {
                    errors.push(String::from("Длина года с учетом високосной добавки не может быть неположительной"));
                }
                crate::leap::LeapValidationError::InvalidTargetMonth => {
                    errors.push(String::from("Целевой месяц високосной добавки находится вне допустимого диапазона"));
                }
            },
            crate::conversion::CalendarConfigValidationError::EraError(e_err) => match e_err {
                crate::eras::EraValidationError::CountdownMissingEndYear => {
                    errors.push(String::from("Эра обратного отсчета обязана иметь дату окончания (end_year)"));
                }
                crate::eras::EraValidationError::OpenNonTerminalEra => {
                    errors.push(String::from("Промежуточная эра обязана иметь явную дату окончания (end_year)"));
                }
                crate::eras::EraValidationError::EndBeforeStart => {
                    errors.push(String::from("Дата окончания эры предшествует дате начала"));
                }
                crate::eras::EraValidationError::InvalidMonth => {
                    errors.push(String::from("Некорректный месяц в датах эры"));
                }
                crate::eras::EraValidationError::InvalidDay => {
                    errors.push(String::from("Некорректный день в датах эры"));
                }
            },
        }
    }

    // 2. Расчет векового дрейфа
    let drift = drift_per_century_rational(
        config.base_year_days,
        config.harmonics,
        tropical_year_num,
        tropical_year_den,
    );
    let drift_milli = drift.to_milli_days_per_century();

    if drift_milli.abs() > 5000 {
        warnings.push(format!(
            "Высокий вековой дрейф календаря: {:.2} суток за столетие",
            drift_milli as f64 / 1000.0
        ));
    }

    let lcm = harmonics_lcm(config.harmonics);
    if lcm > 500_000 {
        warnings.push(format!("Период повторения цикла високосов велик: {lcm} лет"));
    }

    CalendarAuditReport {
        is_valid: errors.is_empty(),
        errors,
        warnings,
        drift_milli_days_per_century: drift_milli,
        harmonics_cycle_years: lcm,
    }
}

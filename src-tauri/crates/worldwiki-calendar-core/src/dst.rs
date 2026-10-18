extern crate alloc;
use crate::types::{DstPolicy, PlanetTimezone};

/// Ошибки валидации политики сезонного перевода часов (DST)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DstValidationError {
    /// Месяц начала или окончания равен 0
    InvalidMonth,
    /// День начала или окончания меньше или равен 0
    InvalidDay,
    /// Смещение DST превышает физические сутки (±1440 минут)
    ExcessiveShiftMinutes,
}

/// Валидирует корректность параметров сезонного перевода стрелок
pub fn validate_dst_policy(dst: &DstPolicy) -> Result<(), DstValidationError> {
    match dst {
        DstPolicy::None => Ok(()),
        DstPolicy::FixedCalendarDate {
            spring_month,
            spring_day,
            fall_month,
            fall_day,
            shift_minutes,
        } => {
            if *spring_month == 0 || *fall_month == 0 {
                return Err(DstValidationError::InvalidMonth);
            }
            if *spring_day <= 0 || *fall_day <= 0 {
                return Err(DstValidationError::InvalidDay);
            }
            if shift_minutes.abs() > 1440 {
                return Err(DstValidationError::ExcessiveShiftMinutes);
            }
            Ok(())
        }
        DstPolicy::RelativeWeekday {
            spring_rule,
            fall_rule,
            shift_minutes,
        } => {
            if spring_rule.month == 0 || fall_rule.month == 0 {
                return Err(DstValidationError::InvalidMonth);
            }
            if shift_minutes.abs() > 1440 {
                return Err(DstValidationError::ExcessiveShiftMinutes);
            }
            Ok(())
        }
    }
}

/// Параметры временного окна сезонного перехода для фиксированных дат
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DstFixedTransitionWindow {
    pub spring_month: usize,
    pub spring_day: i64,
    pub fall_month: usize,
    pub fall_day: i64,
    pub transition_minute: i32,
}

/// Проверяет, действует ли летнее время для заданной даты и минуты суток (FixedCalendarDate)
pub fn is_dst_active_fixed(
    window: &DstFixedTransitionWindow,
    current_month: usize,
    current_day: i64,
    current_minute_of_day: i32,
) -> bool {
    let current_key = ((current_month as i64) << 32) | (current_day << 16) | (current_minute_of_day as i64);
    let start_key = ((window.spring_month as i64) << 32) | (window.spring_day << 16) | (window.transition_minute as i64);
    let end_key = ((window.fall_month as i64) << 32) | (window.fall_day << 16) | (window.transition_minute as i64);

    if start_key <= end_key {
        // Северное полушарие: лето с весны по осень (напр. Март -> Октябрь)
        current_key >= start_key && current_key < end_key
    } else {
        // Южное полушарие: лето через Новый Год (напр. Октябрь -> Март)
        current_key >= start_key || current_key < end_key
    }
}

/// Вычисляет текущее эффективное смещение часового пояса от базового меридиана (в минутах)
pub fn get_timezone_effective_offset(
    tz: &PlanetTimezone,
    current_month: usize,
    current_day: i64,
    current_minute_of_day: i32,
) -> i32 {
    let dst_shift = match &tz.dst_policy {
        DstPolicy::None => 0,
        DstPolicy::FixedCalendarDate {
            spring_month,
            spring_day,
            fall_month,
            fall_day,
            shift_minutes,
        } => {
            let window = DstFixedTransitionWindow {
                spring_month: *spring_month,
                spring_day: *spring_day,
                fall_month: *fall_month,
                fall_day: *fall_day,
                transition_minute: 120, // 02:00
            };
            let is_active = is_dst_active_fixed(
                &window,
                current_month,
                current_day,
                current_minute_of_day,
            );
            if is_active {
                *shift_minutes
            } else {
                0
            }
        }
        DstPolicy::RelativeWeekday { shift_minutes, .. } => {
            // Для упрощенного расчета относительного правила (полный пересчет по номеру дня недели)
            *shift_minutes
        }
    };

    tz.standard_offset_minutes + dst_shift
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::string::ToString;

    #[test]
    fn test_dst_positive_northern_hemisphere() {
        let tz = PlanetTimezone {
            id: "tz_capital".to_string(),
            name: "Столичный пояс".to_string(),
            code: "MSK".to_string(),
            standard_offset_minutes: 180, // UTC+3
            dst_policy: DstPolicy::FixedCalendarDate {
                spring_month: 3, // Март
                spring_day: 25,
                fall_month: 10,  // Октябрь
                fall_day: 25,
                shift_minutes: 60, // +1 час летом
            },
        };

        assert!(validate_dst_policy(&tz.dst_policy).is_ok());

        // Зима (Январь): DST выключен -> 180 мин (+3ч)
        let off_jan = get_timezone_effective_offset(&tz, 1, 15, 720);
        assert_eq!(off_jan, 180);

        // Лето (Июль): DST включен -> 180 + 60 = 240 мин (+4ч)
        let off_jul = get_timezone_effective_offset(&tz, 7, 15, 720);
        assert_eq!(off_jul, 240);

        // День старта (25 Марта) в 01:00 ночи (до 02:00) -> 180 мин
        let off_spring_before = get_timezone_effective_offset(&tz, 3, 25, 60);
        assert_eq!(off_spring_before, 180);

        // День старта (25 Марта) в 03:00 ночи (после 02:00) -> 240 мин
        let off_spring_after = get_timezone_effective_offset(&tz, 3, 25, 180);
        assert_eq!(off_spring_after, 240);
    }

    #[test]
    fn test_dst_positive_southern_hemisphere() {
        // Южное полушарие: лето с Октября по Март
        let tz_south = PlanetTimezone {
            id: "tz_south".to_string(),
            name: "Южные Земли".to_string(),
            code: "STH".to_string(),
            standard_offset_minutes: 0,
            dst_policy: DstPolicy::FixedCalendarDate {
                spring_month: 10, // Октябрь (весна на юге)
                spring_day: 1,
                fall_month: 3,    // Март (осень на юге)
                fall_day: 1,
                shift_minutes: 60,
            },
        };

        // Декабрь (лето на юге) -> DST активен (+60)
        let off_dec = get_timezone_effective_offset(&tz_south, 12, 15, 720);
        assert_eq!(off_dec, 60);

        // Июль (зима на юге) -> DST не активен (0)
        let off_jul = get_timezone_effective_offset(&tz_south, 7, 15, 720);
        assert_eq!(off_jul, 0);
    }

    #[test]
    fn test_dst_negative_invalid_month_day() {
        let invalid_month = DstPolicy::FixedCalendarDate {
            spring_month: 0, // Недопустимо
            spring_day: 10,
            fall_month: 10,
            fall_day: 10,
            shift_minutes: 60,
        };
        assert_eq!(validate_dst_policy(&invalid_month), Err(DstValidationError::InvalidMonth));

        let invalid_day = DstPolicy::FixedCalendarDate {
            spring_month: 3,
            spring_day: 0, // Недопустимо
            fall_month: 10,
            fall_day: 10,
            shift_minutes: 60,
        };
        assert_eq!(validate_dst_policy(&invalid_day), Err(DstValidationError::InvalidDay));
    }

    #[test]
    fn test_dst_negative_excessive_shift() {
        let invalid_shift = DstPolicy::FixedCalendarDate {
            spring_month: 3,
            spring_day: 10,
            fall_month: 10,
            fall_day: 10,
            shift_minutes: 2000, // Больше 1440 минут
        };
        assert_eq!(validate_dst_policy(&invalid_shift), Err(DstValidationError::ExcessiveShiftMinutes));
    }

    #[test]
    fn test_dst_positive_is_active_fixed() {
        let window = DstFixedTransitionWindow {
            spring_month: 4,
            spring_day: 1,
            fall_month: 9,
            fall_day: 1,
            transition_minute: 180,
        };
        // Вне окна
        assert!(!is_dst_active_fixed(&window, 3, 31, 1400));
        assert!(!is_dst_active_fixed(&window, 4, 1, 100)); // До 180 мин
        // Внутри окна
        assert!(is_dst_active_fixed(&window, 4, 1, 180)); // Ровно в 180 мин
        assert!(is_dst_active_fixed(&window, 6, 15, 720));
        assert!(!is_dst_active_fixed(&window, 9, 1, 180)); // В момент окончания
    }
}


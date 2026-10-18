extern crate alloc;
use crate::types::{CalendarStyleEra, CalendarSuccession};

/// Ошибки валидации и поиска в цепочке преемственности календарей
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SuccessionValidationError {
    /// Цепочка преемственности пуста
    EmptySuccession,
    /// Идентификатор календаря пуст
    EmptyCalendarId,
    /// Дата окончания предшествует дате начала
    EndBeforeStart,
    /// Нетерминальная (промежуточная) эра обязана иметь дату окончания (effective_to_m_abs)
    OpenNonTerminalEra,
    /// Обнаружено пересечение интервалов действия календарей
    OverlappingEras,
    /// Запрошенная дата предшествует началу действия любого календаря культуры
    DatePrecedesSuccession,
    /// Запрошенная дата превышает окончание последнего зафиксированного календаря
    DateExceedsSuccession,
}

/// Валидирует отдельную эру преемственности календаря
pub fn validate_style_era(era: &CalendarStyleEra, is_terminal: bool) -> Result<(), SuccessionValidationError> {
    if era.calendar_id.trim().is_empty() {
        return Err(SuccessionValidationError::EmptyCalendarId);
    }

    if let Some(to) = era.effective_to_m_abs {
        if to < era.effective_from_m_abs {
            return Err(SuccessionValidationError::EndBeforeStart);
        }
    } else if !is_terminal {
        return Err(SuccessionValidationError::OpenNonTerminalEra);
    }

    Ok(())
}

/// Валидирует всю цепочку преемственности календарей культуры
pub fn validate_succession(succession: &CalendarSuccession) -> Result<(), SuccessionValidationError> {
    if succession.eras.is_empty() {
        return Err(SuccessionValidationError::EmptySuccession);
    }

    let len = succession.eras.len();
    for (i, era) in succession.eras.iter().enumerate() {
        let is_terminal = i + 1 == len;
        validate_style_era(era, is_terminal)?;
    }

    for pair in succession.eras.windows(2) {
        if let [prev, curr] = pair {
            if let Some(prev_to) = prev.effective_to_m_abs {
                if curr.effective_from_m_abs <= prev_to {
                    return Err(SuccessionValidationError::OverlappingEras);
                }
            } else {
                return Err(SuccessionValidationError::OpenNonTerminalEra);
            }
        }
    }

    Ok(())
}

/// Сортирует срез эр преемственности по дате вступления в силу
pub fn sort_succession(succession: &mut CalendarSuccession) {
    succession.eras.sort_by_key(|era| era.effective_from_m_abs);
}

/// Находит активную эру стиля календаря для заданной абсолютной минуты m_abs
pub fn find_active_calendar_era(
    succession: &CalendarSuccession,
    m_abs: i64,
) -> Result<&CalendarStyleEra, SuccessionValidationError> {
    if succession.eras.is_empty() {
        return Err(SuccessionValidationError::EmptySuccession);
    }

    // Проверка нижней границы первой эры
    if succession.eras.first().is_some_and(|first| m_abs < first.effective_from_m_abs) {
        return Err(SuccessionValidationError::DatePrecedesSuccession);
    }

    for era in succession.eras.iter() {
        if m_abs >= era.effective_from_m_abs {
            if let Some(to) = era.effective_to_m_abs {
                if m_abs <= to {
                    return Ok(era);
                }
            } else {
                // Открытая терминальная эра
                return Ok(era);
            }
        }
    }

    Err(SuccessionValidationError::DateExceedsSuccession)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ReformMode;
    use alloc::string::ToString;
    use alloc::vec;

    #[test]
    fn test_succession_positive_lookup() {
        let succession = CalendarSuccession {
            eras: vec![
                CalendarStyleEra {
                    calendar_id: "cal_julian".to_string(),
                    effective_from_m_abs: 0,
                    effective_to_m_abs: Some(100_000),
                    reform_mode: ReformMode::DiscontinuousGap { dropped_days: 0 },
                },
                CalendarStyleEra {
                    calendar_id: "cal_gregorian".to_string(),
                    effective_from_m_abs: 100_001,
                    effective_to_m_abs: None,
                    reform_mode: ReformMode::DiscontinuousGap { dropped_days: 13 },
                },
            ],
        };

        assert!(validate_succession(&succession).is_ok());

        let era_past = find_active_calendar_era(&succession, 50_000);
        assert_eq!(era_past.map(|e| e.calendar_id.as_str()), Ok("cal_julian"));

        let era_exact_border = find_active_calendar_era(&succession, 100_000);
        assert_eq!(era_exact_border.map(|e| e.calendar_id.as_str()), Ok("cal_julian"));

        let era_new = find_active_calendar_era(&succession, 100_001);
        assert_eq!(era_new.map(|e| e.calendar_id.as_str()), Ok("cal_gregorian"));

        let era_future = find_active_calendar_era(&succession, 999_999_999);
        assert_eq!(era_future.map(|e| e.calendar_id.as_str()), Ok("cal_gregorian"));
    }

    #[test]
    fn test_succession_negative_empty() {
        let empty = CalendarSuccession { eras: vec![] };
        assert_eq!(validate_succession(&empty), Err(SuccessionValidationError::EmptySuccession));
        assert_eq!(find_active_calendar_era(&empty, 100), Err(SuccessionValidationError::EmptySuccession));
    }

    #[test]
    fn test_succession_negative_empty_calendar_id() {
        let invalid = CalendarSuccession {
            eras: vec![CalendarStyleEra {
                calendar_id: "   ".to_string(),
                effective_from_m_abs: 0,
                effective_to_m_abs: None,
                reform_mode: ReformMode::DiscontinuousGap { dropped_days: 0 },
            }],
        };
        assert_eq!(validate_succession(&invalid), Err(SuccessionValidationError::EmptyCalendarId));
    }

    #[test]
    fn test_succession_negative_end_before_start() {
        let invalid = CalendarSuccession {
            eras: vec![CalendarStyleEra {
                calendar_id: "cal_a".to_string(),
                effective_from_m_abs: 500,
                effective_to_m_abs: Some(499),
                reform_mode: ReformMode::DiscontinuousGap { dropped_days: 0 },
            }],
        };
        assert_eq!(validate_succession(&invalid), Err(SuccessionValidationError::EndBeforeStart));
    }

    #[test]
    fn test_succession_negative_overlapping_eras() {
        let invalid = CalendarSuccession {
            eras: vec![
                CalendarStyleEra {
                    calendar_id: "cal_a".to_string(),
                    effective_from_m_abs: 0,
                    effective_to_m_abs: Some(100),
                    reform_mode: ReformMode::DiscontinuousGap { dropped_days: 0 },
                },
                CalendarStyleEra {
                    calendar_id: "cal_b".to_string(),
                    effective_from_m_abs: 90, // Пересекает предыдущую эру [0, 100]
                    effective_to_m_abs: None,
                    reform_mode: ReformMode::DiscontinuousGap { dropped_days: 10 },
                },
            ],
        };
        assert_eq!(validate_succession(&invalid), Err(SuccessionValidationError::OverlappingEras));
    }

    #[test]
    fn test_succession_negative_date_out_of_bounds() {
        let succession = CalendarSuccession {
            eras: vec![CalendarStyleEra {
                calendar_id: "cal_modern".to_string(),
                effective_from_m_abs: 1_000,
                effective_to_m_abs: Some(2_000),
                reform_mode: ReformMode::DiscontinuousGap { dropped_days: 0 },
            }],
        };

        // Дата до начала
        assert_eq!(
            find_active_calendar_era(&succession, 999),
            Err(SuccessionValidationError::DatePrecedesSuccession)
        );

        // Дата после окончания закрытой терминальной эры
        assert_eq!(
            find_active_calendar_era(&succession, 2_001),
            Err(SuccessionValidationError::DateExceedsSuccession)
        );
    }

    #[test]
    fn test_sort_succession() {
        let mut succession = CalendarSuccession {
            eras: vec![
                CalendarStyleEra {
                    calendar_id: "cal_3".to_string(),
                    effective_from_m_abs: 300,
                    effective_to_m_abs: None,
                    reform_mode: ReformMode::DiscontinuousGap { dropped_days: 0 },
                },
                CalendarStyleEra {
                    calendar_id: "cal_1".to_string(),
                    effective_from_m_abs: 0,
                    effective_to_m_abs: Some(100),
                    reform_mode: ReformMode::DiscontinuousGap { dropped_days: 0 },
                },
                CalendarStyleEra {
                    calendar_id: "cal_2".to_string(),
                    effective_from_m_abs: 101,
                    effective_to_m_abs: Some(299),
                    reform_mode: ReformMode::DiscontinuousGap { dropped_days: 0 },
                },
            ],
        };

        sort_succession(&mut succession);

        assert_eq!(succession.eras.first().map(|e| e.effective_from_m_abs), Some(0));
        assert_eq!(succession.eras.get(1).map(|e| e.effective_from_m_abs), Some(101));
        assert_eq!(succession.eras.get(2).map(|e| e.effective_from_m_abs), Some(300));
        assert!(validate_succession(&succession).is_ok());
    }

    #[test]
    fn test_succession_negative_open_non_terminal() {
        let invalid = CalendarSuccession {
            eras: vec![
                CalendarStyleEra {
                    calendar_id: "cal_open".to_string(),
                    effective_from_m_abs: 0,
                    effective_to_m_abs: None, // Первая эра не закрыта
                    reform_mode: ReformMode::DiscontinuousGap { dropped_days: 0 },
                },
                CalendarStyleEra {
                    calendar_id: "cal_second".to_string(),
                    effective_from_m_abs: 100,
                    effective_to_m_abs: None,
                    reform_mode: ReformMode::DiscontinuousGap { dropped_days: 0 },
                },
            ],
        };

        assert_eq!(validate_succession(&invalid), Err(SuccessionValidationError::OpenNonTerminalEra));
    }
}

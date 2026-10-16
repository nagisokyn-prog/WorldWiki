use worldwiki_calendar_core::weekdays::*;
use worldwiki_calendar_core::types::LeapHarmonic;

#[test]
fn test_epagomenal_freeze_with_more_extra_days_than_week_len() {
    // Неделя: 5 дней (0..4).
    // Регулярный год: 360 дней.
    // Эпагоменов: 10 дней (больше длины недели!).
    let harmonics: [LeapHarmonic; 0] = [];
    let config = WeekdayPauseConfig {
        days_in_regular_months: 360,
        extra_days_base: 10,
        extra_days_leap: 0,
        harmonics: &harmonics,
        origin_year: 1,
        origin_day: 0,
        start_weekday: 0,
        weekdays_count: 5,
    };

    // Последний регулярный день 1-го года (день 359):
    // 359 % 5 = 4-й день недели
    let last_regular = calculate_weekday_with_pause(1, 359, &config);
    assert_eq!(last_regular, Some(4));

    // Все 10 эпагоменов (дни 360..369) "заморожены" вне недели -> None
    for extra in 360..370 {
        assert_eq!(
            calculate_weekday_with_pause(1, extra, &config),
            None,
            "Extra day {extra} must be outside weekly cycle"
        );
    }

    // Первый регулярный день 2-го года (день 0):
    // Счёт дней недели возобновляется СТРОГО со следующего дня (0-й день недели)!
    let first_regular_next_year = calculate_weekday_with_pause(2, 0, &config);
    assert_eq!(
        first_regular_next_year,
        Some(0),
        "Weekly cycle must resume exactly after pause"
    );
}

#[test]
fn test_empty_weekdays_error() {
    assert_eq!(validate_weekdays_count(0), Err(WeekdayError::EmptyWeekdays));
    assert_eq!(validate_weekdays_count(7), Ok(()));

    assert_eq!(try_calculate_weekday(10, 0, 0, 0), Err(WeekdayError::EmptyWeekdays));
    assert_eq!(calculate_weekday(10, 0, 0, 0), 0);
}
